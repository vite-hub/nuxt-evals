# Writes the A2UI system prompt that the A2UI eval gives a model for the direct_json format,
# with the v1.0 basic catalog: DirectJsonFormat([catalog]).prompt_generator.generate().
# Run it with the A2UI Python SDK (python/a2ui_core and python/a2ui_agent of a2ui-project/a2ui) installed:
#   python direct_json_prompt.py <a2ui>/catalogs/basic/v1/catalog.json > direct_json_prompt.txt
import sys

from a2ui.inference_formats.direct_json.format import DirectJsonFormat
from a2ui.processor import CatalogConfig

catalog = CatalogConfig.from_path(sys.argv[1], protocol_version="1.0").transformed_catalog
print(DirectJsonFormat([catalog]).prompt_generator.generate())
