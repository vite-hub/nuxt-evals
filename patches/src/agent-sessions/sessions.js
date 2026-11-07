//#region src/sessions.ts
// Provider session files as Agent Invocations.
//
// A coding agent that runs outside the app (Codex or Claude Code on a laptop, in CI, on a runner) writes its own
// session file. `readCodexSession()` and `readClaudeCodeSession()` turn that file into one provider-neutral
// `AgentSession`. `importAgentSession()` writes it to an Agent Invocation store as a finished Invocation, with the
// original timestamps, so the Console shows it like a session that ran in the app: messages, thinking, commands with
// their output, file changes as diffs, and usage.

const MAX_CONTENT_LENGTH = 32 * 1024;
const MAX_METADATA_LENGTH = 512;

function parseLines(text) {
	const values = [];
	for (const line of String(text).split("\n")) {
		if (!line.trim()) continue;
		try {
			values.push(JSON.parse(line));
		} catch {}
	}
	return values;
}

function isRecord(value) {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function string(value) {
	return typeof value === "string" ? value : void 0;
}

function number(value) {
	return typeof value === "number" && Number.isFinite(value) ? value : void 0;
}

function parseJson(value) {
	if (typeof value !== "string") return value;
	try {
		return JSON.parse(value);
	} catch {
		return value;
	}
}

function bounded(value, limit = MAX_CONTENT_LENGTH) {
	if (typeof value !== "string" || value.length <= limit) return value;
	return `${value.slice(0, limit)}\n… ${value.length - limit} more characters`;
}

function boundedValue(value) {
	if (typeof value === "string") return bounded(value);
	if (Array.isArray(value)) return value.map(boundedValue);
	if (isRecord(value)) return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, boundedValue(item)]));
	return value;
}

function relativePath(path, cwd) {
	if (!cwd || !path.startsWith(`${cwd}/`)) return path.replace(/^\/+/, "");
	return path.slice(cwd.length + 1);
}

function lineCount(text) {
	if (!text) return 0;
	return text.endsWith("\n") ? text.split("\n").length - 1 : text.split("\n").length;
}

function addedFileDiff(content) {
	const lines = content.endsWith("\n") ? content.slice(0, -1).split("\n") : content.split("\n");
	return `@@ -0,0 +1,${lines.length} @@\n${lines.map((line) => `+${line}`).join("\n")}\n`;
}

/**
* Codex `apply_patch` text to file changes with unified diff hunks. The patch format has no line numbers, so each hunk
* starts at line 1. The Console only renders the hunks.
*/
function applyPatchChanges(patch, cwd) {
	const changes = [];
	let current;
	let hunk;
	const closeHunk = () => {
		if (!current || !hunk || !hunk.lines.length) return;
		const oldLines = hunk.lines.filter((line) => !line.startsWith("+")).length;
		const newLines = hunk.lines.filter((line) => !line.startsWith("-")).length;
		current.hunks.push(`@@ -${oldLines ? 1 : 0},${oldLines} +${newLines ? 1 : 0},${newLines} @@${hunk.header ? ` ${hunk.header}` : ""}\n${hunk.lines.join("\n")}\n`);
		hunk = void 0;
	};
	for (const line of patch.split("\n")) {
		const file = /^\*\*\* (Add|Update|Delete) File: (.+)$/.exec(line);
		if (file) {
			closeHunk();
			current = { kind: file[1].toLowerCase(), path: relativePath(file[2].trim(), cwd), hunks: [] };
			changes.push(current);
			continue;
		}
		if (!current || line === "*** End Patch" || line === "*** End of File") continue;
		const move = /^\*\*\* Move to: (.+)$/.exec(line);
		if (move) {
			current.movePath = relativePath(move[1].trim(), cwd);
			continue;
		}
		if (line.startsWith("@@")) {
			closeHunk();
			hunk = { header: line.replace(/^@@\s*/, ""), lines: [] };
			continue;
		}
		if (/^[ +-]/.test(line)) {
			hunk ??= { header: "", lines: [] };
			hunk.lines.push(line);
		}
	}
	closeHunk();
	return changes.map((change) => ({
		path: change.movePath ?? change.path,
		kind: change.kind,
		diff: change.hunks.join("")
	}));
}

function fileChangeOutput(changes) {
	return { item: { type: "fileChange", changes } };
}

function emptyUsage() {
	return { inputTokens: 0, cachedInputTokens: 0, outputTokens: 0, reasoningTokens: 0, totalTokens: 0 };
}

//#endregion
//#region Codex

/** Codex `exec_command` output: a text block with the exit code, or JSON with `output` and `metadata.exit_code`. */
function codexCommandOutput(raw) {
	const value = parseJson(raw);
	if (isRecord(value)) {
		const metadata = isRecord(value.metadata) ? value.metadata : {};
		return { output: string(value.output) ?? "", exitCode: number(metadata.exit_code), durationMs: number(metadata.duration_seconds) === void 0 ? void 0 : Math.round(metadata.duration_seconds * 1e3) };
	}
	const text = String(raw ?? "");
	const exit = /Process exited with code (-?\d+)/.exec(text);
	const wall = /Wall time: ([\d.]+) seconds/.exec(text);
	const marker = text.indexOf("Output:\n");
	return {
		output: marker === -1 ? text : text.slice(marker + "Output:\n".length),
		exitCode: exit ? Number(exit[1]) : void 0,
		durationMs: wall ? Math.round(Number(wall[1]) * 1e3) : void 0
	};
}

function codexToolCall(name, rawArguments, id, timestamp, cwd) {
	const input = parseJson(rawArguments);
	const args = isRecord(input) ? input : {};
	const command = string(args.cmd) ?? (Array.isArray(args.command) ? args.command.join(" ") : string(args.command));
	if ((name === "exec_command" || name === "shell" || name === "local_shell" || name === "container.exec") && command !== void 0) {
		const patch = /\*\*\* Begin Patch[\s\S]*?\*\*\* End Patch/.exec(command)?.[0];
		const workdir = string(args.workdir) ?? cwd;
		return {
			type: "tool",
			id,
			timestamp,
			name: "command_execution",
			input: { command, ...(workdir ? { cwd: workdir } : {}) },
			...(patch ? { changes: applyPatchChanges(patch, workdir) } : {})
		};
	}
	return { type: "tool", id, timestamp, name, input };
}

function finishCodexTool(step, raw, timestamp) {
	step.completedAt = timestamp;
	if (step.name === "command_execution") {
		const result = codexCommandOutput(raw);
		step.output = { command: step.input.command, output: result.output, ...(result.exitCode === void 0 ? {} : { exitCode: result.exitCode }) };
		if (result.durationMs !== void 0) step.durationMs = result.durationMs;
		if (result.exitCode !== void 0 && result.exitCode !== 0) step.error = `Exited with code ${result.exitCode}.`;
		if (step.changes) {
			step.kind = "change";
			step.output = { ...step.output, ...fileChangeOutput(step.changes) };
		}
		delete step.changes;
		return;
	}
	if (step.name === "apply_patch") {
		step.output = { ...fileChangeOutput(step.changes ?? []), output: String(raw ?? "") };
		delete step.changes;
		return;
	}
	step.output = parseJson(raw);
}

function codexUsage(info) {
	const total = isRecord(info?.total_token_usage) ? info.total_token_usage : void 0;
	if (!total) return;
	return {
		inputTokens: number(total.input_tokens) ?? 0,
		cachedInputTokens: number(total.cached_input_tokens) ?? 0,
		outputTokens: number(total.output_tokens) ?? 0,
		reasoningTokens: number(total.reasoning_output_tokens) ?? 0,
		totalTokens: number(total.total_tokens) ?? 0
	};
}

/**
* Read a Codex session file (`$CODEX_HOME/sessions/YYYY/MM/DD/rollout-*.jsonl`).
* Developer and context messages are left out. Reasoning appears only when Codex wrote a summary for it
* (`model_reasoning_summary`); encrypted reasoning has no text to show.
*/
function readCodexSession(text) {
	const session = { provider: "codex", status: "completed", steps: [], usage: emptyUsage() };
	const tools = /* @__PURE__ */ new Map();
	for (const line of parseLines(text)) {
		const payload = isRecord(line.payload) ? line.payload : {};
		const timestamp = string(line.timestamp) ?? session.completedAt ?? new Date(0).toISOString();
		session.startedAt ??= timestamp;
		session.completedAt = timestamp;
		if (line.type === "session_meta") {
			session.id ??= string(payload.id);
			session.cwd ??= string(payload.cwd);
			session.version ??= string(payload.cli_version);
			continue;
		}
		if (line.type === "turn_context") {
			session.model ??= string(payload.model);
			session.reasoningEffort ??= string(payload.effort) ?? string(payload.reasoning_effort);
			continue;
		}
		if (line.type === "event_msg") {
			if (payload.type === "user_message") session.prompt ??= string(payload.message);
			else if (payload.type === "token_count") session.usage = codexUsage(payload.info) ?? session.usage;
			else if (payload.type === "task_complete") session.text = string(payload.last_agent_message) ?? session.text;
			else if (payload.type === "turn_aborted") {
				session.status = "failed";
				session.error = `The turn was aborted${payload.reason ? `: ${payload.reason}` : "."}`;
			} else if (payload.type === "error") {
				session.status = "failed";
				session.error = string(payload.message) ?? "Codex reported an error.";
			}
			continue;
		}
		if (line.type !== "response_item") continue;
		if (payload.type === "message" && payload.role === "user") {
			// `codex exec` writes no `user_message` event. Codex injects context as user messages that start with a tag.
			const content = Array.isArray(payload.content) ? payload.content : [];
			const userText = content.map((part) => isRecord(part) ? string(part.text) ?? "" : "").join("");
			if (userText.trim() && !userText.trimStart().startsWith("<")) session.prompt ??= userText;
			continue;
		}
		if (payload.type === "message" && payload.role === "assistant") {
			const content = Array.isArray(payload.content) ? payload.content : [];
			const messageText = content.map((part) => isRecord(part) ? string(part.text) ?? "" : "").join("");
			if (!messageText.trim()) continue;
			session.steps.push({ type: "message", id: string(payload.id) ?? `message-${session.steps.length}`, timestamp, phase: payload.phase === "final_answer" ? "final" : "commentary", text: messageText });
			continue;
		}
		if (payload.type === "reasoning") {
			const summary = Array.isArray(payload.summary) ? payload.summary : [];
			const content = Array.isArray(payload.content) ? payload.content : [];
			const reasoning = [...summary, ...content].map((part) => isRecord(part) ? string(part.text) ?? "" : "").filter(Boolean).join("\n\n");
			if (reasoning.trim()) session.steps.push({ type: "message", id: string(payload.id) ?? `reasoning-${session.steps.length}`, timestamp, phase: "reasoning", text: reasoning });
			continue;
		}
		if (payload.type === "function_call") {
			const id = string(payload.call_id) ?? `tool-${session.steps.length}`;
			const step = codexToolCall(string(payload.name) ?? "tool", payload.arguments, id, timestamp, session.cwd);
			session.steps.push(step);
			tools.set(id, step);
			continue;
		}
		if (payload.type === "custom_tool_call") {
			const id = string(payload.call_id) ?? `tool-${session.steps.length}`;
			const name = string(payload.name) ?? "tool";
			const input = string(payload.input) ?? payload.input;
			const step = name === "apply_patch" && typeof input === "string"
				? { type: "tool", id, timestamp, name, kind: "change", input: { patch: input }, changes: applyPatchChanges(input, session.cwd) }
				: { type: "tool", id, timestamp, name, input };
			session.steps.push(step);
			tools.set(id, step);
			continue;
		}
		if (payload.type === "function_call_output" || payload.type === "custom_tool_call_output") {
			const step = tools.get(string(payload.call_id) ?? "");
			if (step) finishCodexTool(step, payload.output, timestamp);
			continue;
		}
		if (payload.type === "web_search_call") {
			const action = isRecord(payload.action) ? payload.action : {};
			session.steps.push({
				type: "tool",
				id: string(payload.id) ?? `web-search-${session.steps.length}`,
				timestamp,
				completedAt: timestamp,
				name: "web_search",
				title: string(action.query) ? `Searched the web for ${action.query}` : "Searched the web",
				input: action,
				output: { status: payload.status }
			});
		}
	}
	session.text ??= session.steps.findLast((step) => step.type === "message" && step.phase === "final")?.text;
	return session;
}

//#endregion
//#region Claude Code

function claudeToolResultText(content) {
	if (typeof content === "string") return content;
	if (!Array.isArray(content)) return "";
	return content.map((part) => isRecord(part) && part.type === "text" ? string(part.text) ?? "" : "").join("");
}

function structuredPatchDiff(hunks) {
	if (!Array.isArray(hunks)) return "";
	return hunks.map((hunk) => {
		if (!isRecord(hunk) || !Array.isArray(hunk.lines)) return "";
		return `@@ -${hunk.oldStart ?? 0},${hunk.oldLines ?? 0} +${hunk.newStart ?? 0},${hunk.newLines ?? 0} @@\n${hunk.lines.join("\n")}\n`;
	}).join("");
}

const claudeFileTools = new Set(["Edit", "MultiEdit", "Write", "NotebookEdit"]);

function claudeToolCall(block, timestamp, cwd) {
	const input = isRecord(block.input) ? block.input : {};
	const step = { type: "tool", id: string(block.id) ?? `tool-${timestamp}`, timestamp, name: string(block.name) ?? "tool", input };
	if (step.name === "Bash") {
		step.input = { command: string(input.command) ?? "", ...(cwd ? { cwd } : {}) };
		step.title = string(input.description);
	} else if (claudeFileTools.has(step.name)) step.kind = "change";
	if (string(input.file_path)) step.title ??= `${step.name} ${relativePath(input.file_path, cwd)}`;
	return step;
}

function finishClaudeTool(step, block, result, timestamp, cwd) {
	step.completedAt = timestamp;
	const text = claudeToolResultText(block.content);
	if (block.is_error === true) step.error = text || "The tool failed.";
	if (step.name === "Bash") {
		const output = isRecord(result) ? [string(result.stdout), string(result.stderr)].filter(Boolean).join("\n") : text;
		step.output = { command: step.input.command, output: output || text };
		return;
	}
	if (step.kind === "change") {
		const path = string(step.input.file_path) ?? string(result?.filePath) ?? "";
		const diff = isRecord(result) && Array.isArray(result.structuredPatch) && result.structuredPatch.length
			? structuredPatchDiff(result.structuredPatch)
			: isRecord(result) && result.type === "create" && typeof result.content === "string"
				? addedFileDiff(result.content)
				: step.name === "Write" && typeof step.input.content === "string" ? addedFileDiff(step.input.content) : "";
		step.output = { ...fileChangeOutput([{ path: relativePath(path, cwd), kind: result?.type === "create" ? "add" : "update", diff }]), output: text };
		return;
	}
	step.output = text || result;
}

/**
* Read a Claude Code session file (`$CLAUDE_CONFIG_DIR/projects/<project>/<session>.jsonl`).
* Thinking blocks become reasoning steps. Subagent (sidechain) lines are left out.
*/
function readClaudeCodeSession(text) {
	const session = { provider: "claude-code", status: "completed", steps: [], usage: emptyUsage() };
	const tools = /* @__PURE__ */ new Map();
	const usageByMessage = /* @__PURE__ */ new Map();
	for (const line of parseLines(text)) {
		if (line.isSidechain === true || (line.type !== "user" && line.type !== "assistant")) continue;
		const timestamp = string(line.timestamp) ?? session.completedAt ?? new Date(0).toISOString();
		session.startedAt ??= timestamp;
		session.completedAt = timestamp;
		session.id ??= string(line.sessionId);
		session.cwd ??= string(line.cwd);
		session.version ??= string(line.version);
		const message = isRecord(line.message) ? line.message : {};
		const content = message.content;
		if (line.type === "user") {
			if (line.isMeta === true) continue;
			if (typeof content === "string") {
				session.prompt ??= content;
				continue;
			}
			for (const block of Array.isArray(content) ? content : []) {
				if (!isRecord(block)) continue;
				if (block.type === "text" && !session.prompt) session.prompt = string(block.text);
				if (block.type === "tool_result") {
					const step = tools.get(string(block.tool_use_id) ?? "");
					if (step) finishClaudeTool(step, block, line.toolUseResult, timestamp, session.cwd);
				}
			}
			continue;
		}
		session.model ??= string(message.model);
		if (string(message.id) && isRecord(message.usage)) usageByMessage.set(message.id, message.usage);
		if (message.stop_reason === "refusal") {
			session.status = "failed";
			session.error = "The model refused.";
		}
		for (const block of Array.isArray(content) ? content : []) {
			if (!isRecord(block)) continue;
			if (block.type === "thinking" && string(block.thinking)?.trim()) session.steps.push({ type: "message", id: `${message.id ?? "thinking"}:${session.steps.length}`, timestamp, phase: "reasoning", text: block.thinking });
			else if (block.type === "text" && string(block.text)?.trim()) session.steps.push({ type: "message", id: `${message.id ?? "text"}:${session.steps.length}`, timestamp, phase: "commentary", text: block.text });
			else if (block.type === "tool_use") {
				const step = claudeToolCall(block, timestamp, session.cwd);
				session.steps.push(step);
				tools.set(step.id, step);
			}
		}
	}
	for (const usage of usageByMessage.values()) {
		const cacheRead = number(usage.cache_read_input_tokens) ?? 0;
		const input = (number(usage.input_tokens) ?? 0) + cacheRead + (number(usage.cache_creation_input_tokens) ?? 0);
		const output = number(usage.output_tokens) ?? 0;
		session.usage.inputTokens += input;
		session.usage.cachedInputTokens += cacheRead;
		session.usage.outputTokens += output;
		session.usage.totalTokens += input + output;
	}
	const final = session.steps.findLast((step) => step.type === "message" && step.phase === "commentary");
	if (final) {
		final.phase = "final";
		session.text = final.text;
	}
	return session;
}

/** Read a session file of a known provider. */
function readAgentSession(provider, text) {
	if (provider === "codex") return readCodexSession(text);
	if (provider === "claude-code") return readClaudeCodeSession(text);
	throw new TypeError(`[vitehub] Unknown session provider ${JSON.stringify(provider)}. Use "codex" or "claude-code".`);
}

//#endregion
//#region Invocation

async function sha256(value) {
	const digest = await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
	return `sha256_${[...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}

function durationMs(from, to) {
	const value = Date.parse(to) - Date.parse(from);
	return Number.isFinite(value) && value >= 0 ? value : void 0;
}

/**
* The Agent Invocation record of a session. The id is the one ViteHub gives a run of `agentName` with `runId`,
* so `/_vitehub/agents/<agentName>/invocations/<id>` opens it in the Console.
*/
async function agentSessionInvocation(session, options) {
	const agentName = options.agentName;
	const runId = options.runId;
	if (!agentName?.trim() || !runId?.trim()) throw new TypeError("[vitehub] importAgentSession() needs agentName and runId.");
	const id = await sha256(JSON.stringify([agentName, runId]));
	const traceId = await sha256(JSON.stringify(["trace", agentName, runId]));
	const startedAt = session.startedAt ?? new Date().toISOString();
	const completedAt = session.completedAt ?? startedAt;
	const invoker = options.invoker ?? { id: "import", kind: "import", label: "Imported session" };
	const ids = { "agent.invocation.id": runId, "agent.run.id": runId };
	const invokerAttributes = { "agent.invoker.id": invoker.id, "agent.invoker.kind": invoker.kind ?? "import", "agent.invoker.label": invoker.label ?? invoker.id };
	const observations = [];
	const add = (name, timestamp, attributes, owner = "agent", type = "run") => {
		const phase = owner === "vitehub" ? "setup" : "execution";
		observations.push({
			name,
			type,
			trace: { id: traceId },
			activity: { owner, phase },
			attributes: { ...ids, ...attributes, "vitehub.activity.owner": owner, "vitehub.activity.phase": phase },
			sequence: observations.length + 1,
			timestamp
		});
	};
	const extra = options.configuration ?? {};
	const configuration = {
		agent: { name: agentName },
		capabilities: [],
		driver: {
			kind: session.provider,
			provider: session.provider,
			...(session.model ? { model: { id: session.model, provider: session.provider } } : {}),
			...(session.reasoningEffort ? { reasoningEffort: session.reasoningEffort } : {}),
			...(session.version ? { version: session.version } : {})
		},
		runtime: { name: "import" },
		...(extra.skills ? { skills: extra.skills.slice(0, 200) } : {}),
		...(extra.mcpServers ? { mcpServers: extra.mcpServers.slice(0, 50) } : {}),
		...(extra.tools ? { tools: extra.tools.slice(0, 200) } : {}),
		...(extra.workspace ? { workspace: extra.workspace } : {})
	};
	const fingerprint = await sha256(JSON.stringify(configuration));
	add("vitehub.agent.configured", startedAt, { "vitehub.agent.configuration": { ...configuration, fingerprint }, "vitehub.agent.configuration.fingerprint": fingerprint }, "vitehub");
	add("agent.invocation.start", startedAt, {
		...invokerAttributes,
		"runtime.name": "import",
		"input.hasPrompt": Boolean(session.prompt),
		...(session.prompt ? { "input.prompt": bounded(session.prompt), "input.prompt.truncated": session.prompt.length > MAX_CONTENT_LENGTH } : {}),
		"session.provider": session.provider,
		...(session.id ? { "session.id": session.id } : {})
	});
	const title = options.title?.trim().slice(0, MAX_METADATA_LENGTH);
	if (title) add("agent.title.recorded", startedAt, { "vitehub.session.title": title });
	for (const step of session.steps) {
		if (step.type === "message") {
			add("agent.message.delta", step.timestamp, { "message.id": step.id, "message.phase": step.phase, "message.role": "assistant", "message.content": bounded(step.text) });
			continue;
		}
		const tool = {
			"gen_ai.operation.name": "execute_tool",
			"gen_ai.tool.call.id": step.id,
			"gen_ai.tool.name": step.name,
			"step.id": step.id,
			"tool.id": step.id,
			"tool.name": step.name,
			"vitehub.activity.kind": step.kind ?? "tool",
			...(step.title ? { "tool.title": bounded(step.title, MAX_METADATA_LENGTH) } : {})
		};
		add("agent.tool.start", step.timestamp, { ...tool, "tool.hasInput": step.input !== void 0, ...(step.input === void 0 ? {} : { "tool.input": boundedValue(step.input) }) });
		const finishedAt = step.completedAt ?? step.timestamp;
		add("agent.tool.finish", finishedAt, {
			...tool,
			"tool.durationMs": step.durationMs ?? durationMs(step.timestamp, finishedAt) ?? 0,
			"tool.hasOutput": step.output !== void 0,
			...(step.output === void 0 ? {} : { "tool.output": boundedValue(step.output) }),
			...(step.error ? { "tool.error": bounded(step.error) } : {})
		});
	}
	const usage = session.usage ?? emptyUsage();
	const cost = options.cost ? {
		usd: String(options.cost.usd),
		estimated: options.cost.estimated ?? true,
		source: options.cost.source ?? "custom",
		display: `${options.cost.estimated ?? true ? "~" : ""}$${options.cost.usd}`
	} : void 0;
	const usageRecord = {
		model: session.model ?? "unknown",
		provider: session.provider,
		...(cost ? { cost } : {}),
		usage: {
			inputTokens: usage.inputTokens,
			outputTokens: usage.outputTokens,
			totalTokens: usage.totalTokens || usage.inputTokens + usage.outputTokens,
			inputTokenDetails: { cacheReadTokens: usage.cachedInputTokens },
			outputTokenDetails: { reasoningTokens: usage.reasoningTokens }
		}
	};
	add("agent.usage.recorded", completedAt, {
		"usage.model": usageRecord.model,
		"usage.provider": session.provider,
		"usage.inputTokens": usage.inputTokens,
		"usage.cachedInputTokens": usage.cachedInputTokens,
		"usage.outputTokens": usage.outputTokens,
		"usage.reasoningTokens": usage.reasoningTokens,
		"usage.totalTokens": usageRecord.usage.totalTokens,
		"usage.hasCost": Boolean(cost),
		...(cost ? { "usage.costUsd": cost.usd, "usage.costEstimated": cost.estimated, "usage.costSource": cost.source } : {}),
		"usage.hasRaw": false
	});
	const failed = session.status === "failed";
	add("agent.stream.finish", completedAt, { "finish.reason": failed ? "error" : "completed" });
	add(failed ? "agent.invocation.error" : "agent.invocation.finish", completedAt, {
		...invokerAttributes,
		"runtime.name": "import",
		"input.hasPrompt": Boolean(session.prompt),
		"invocation.durationMs": durationMs(startedAt, completedAt) ?? 0,
		"usage.record": usageRecord,
		...(failed ? { "error.message": session.error ?? "The session failed." } : { "result.hasValue": Boolean(session.text), "result.kind": "text", ...(session.text ? { "result.text": bounded(session.text) } : {}) })
	}, "agent", failed ? "error" : "run");
	return {
		id,
		agentName,
		traceId,
		status: failed ? "failed" : "completed",
		createdAt: startedAt,
		startedAt,
		updatedAt: completedAt,
		...(failed ? { failedAt: completedAt } : { completedAt }),
		...(title ? { title, titleSequence: observations.find((observation) => observation.name === "agent.title.recorded")?.sequence } : {}),
		...(options.annotations ? { annotations: options.annotations } : {}),
		observations
	};
}

/**
* Write a session to an Agent Invocation store as a finished Invocation. Importing the same `agentName` and `runId`
* again replaces the earlier record.
*/
async function importAgentSession(store, session, options) {
	const record = await agentSessionInvocation(session, options);
	const existing = await store.getSummary(record.id);
	if (existing) {
		if (!store.delete) throw new TypeError("[vitehub] importAgentSession() replaces an earlier import, and this store cannot delete records.");
		await store.delete(record.id);
	}
	const { created } = await store.create(record);
	return { id: record.id, created, replaced: Boolean(existing) };
}

//#endregion
export { agentSessionInvocation, importAgentSession, readAgentSession, readClaudeCodeSession, readCodexSession };
