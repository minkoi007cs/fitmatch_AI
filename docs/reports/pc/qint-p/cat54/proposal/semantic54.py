"""CAT54 proposal: visible attributes for analysis categories, CPU import only.

The pinned quality02 schema supplies the unchanged attribute vocabulary. This
module changes category/version and validates top structure without coercion.
It does not modify the legacy parser or establish image truth.
"""
import copy

from jsonschema import Draft202012Validator

from boundary import strict_json
import semantic

TOPS = frozenset({'tshirt', 'shirt', 'hoodie', 'jacket', 'sweater'})
SUPPORTED = TOPS | {'jeans'}
SCHEMA = copy.deepcopy(semantic.SCHEMA)
SCHEMA['properties']['schema_version'] = {'const': 'pc-ai.grounded-attributes.v3'}
SCHEMA['properties']['category'] = {'enum': sorted(SUPPORTED | {'unknown'})}
VALIDATOR = Draft202012Validator(SCHEMA)


def parse(raw):
    value = strict_json(raw, 8192)
    VALIDATOR.validate(value)
    category = value['category']
    structure = (value['neckline'], value['sleeves'])
    if category == 'jeans' and structure != ('not_applicable', 'not_applicable'):
        raise ValueError('jeans_has_top_only_fields')
    if category in TOPS and 'not_applicable' in structure:
        raise ValueError('top_fields_not_applicable')
    if category == 'unknown' and structure != ('unknown', 'unknown'):
        raise ValueError('unknown_category_has_specific_structure')
    if value['logo_presence'] != 'visible' and value['logo_texts']:
        raise ValueError('text_without_visible_logo')
    if 'unknown' in value['dominant_colors'] and len(value['dominant_colors']) != 1:
        raise ValueError('unknown_color_mixed_with_claim')
    normalized = [semantic.normalize(text) for text in value['logo_texts']]
    if len(set(normalized)) != len(normalized):
        raise ValueError('duplicate_logo_after_normalization')
    return value
