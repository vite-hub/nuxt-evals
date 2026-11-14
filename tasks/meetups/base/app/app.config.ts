export default defineAppConfig({
  ui: {
    colors: {
      primary: "brand",
      neutral: "zinc",
    },
    input: { slots: { base: "placeholder:text-muted" } },
    textarea: { slots: { base: "placeholder:text-muted" } },
    button: {
      compoundVariants: [{
        color: "primary",
        variant: "solid",
        class: "hover:bg-(--ui-color-primary-800) active:bg-(--ui-color-primary-800) dark:hover:bg-(--ui-color-primary-400) dark:active:bg-(--ui-color-primary-400)",
      }],
    },
  },
})
