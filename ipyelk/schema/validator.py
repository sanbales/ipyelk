import json
from pathlib import Path

import jsonschema

HERE = Path(__file__).parent
SCHEMA = json.loads((HERE / "elkschema.json").read_text(encoding="utf-8"))
SCHEMA["$ref"] = "#/definitions/AnyElkNode"

ElkSchemaValidator = jsonschema.Draft7Validator(SCHEMA)