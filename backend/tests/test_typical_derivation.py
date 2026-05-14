import sys
import unittest
from pathlib import Path


BACKEND_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND_ROOT))

from app.schemas import EquipmentTypicalCreate, TypicalDerivationParameterSelection  # noqa: E402
from app.typicals import derive_typical_preview, validate_typical_payload  # noqa: E402
from app.projects import _derive_instance_interfaces  # noqa: E402
from app.project_models import (  # noqa: E402
    InstanceInterfaceGroup,
    InstanceInterfaceMappingRuleSnapshot,
    InstanceParameterSelection,
)


def typical_payload(**overrides):
    payload = {
        "name": "Switch",
        "code": "SW1",
        "etim_class_id": "EC000000",
        "etim_class_description": "Switch",
        "template_key": None,
        "parameter_definitions": [],
        "interface_groups": [],
        "interface_mapping_rules": [],
        "interfaces": [],
    }
    payload.update(overrides)
    return EquipmentTypicalCreate(**payload)


class TypicalDerivationTests(unittest.TestCase):
    def test_defaults_resolve_layout_sides_and_side_order(self):
        preview = derive_typical_preview(
            typical_payload(
                template_key="multi_pole_switch_device",
                parameter_definitions=[
                    {
                        "code": "power_topology",
                        "name": "Power topology",
                        "source": "library",
                        "input_type": "enum",
                        "default_value": "L+N",
                        "allowed_values": ["L", "L+N"],
                        "drives_interfaces": True,
                    }
                ],
            )
        )

        by_code = {interface.code: interface for interface in preview.interfaces}
        self.assertEqual(by_code["L_IN"].side, "left")
        self.assertEqual(by_code["N_IN"].side_order, 1)
        self.assertEqual(by_code["L_OUT"].side, "right")
        self.assertEqual(by_code["N_OUT"].side_order, 1)

    def test_group_side_fallback_wins_over_direction(self):
        preview = derive_typical_preview(
            typical_payload(
                interface_groups=[
                    {"code": "aux", "name": "Aux", "category": "signal", "side": "top"},
                ],
                interfaces=[
                    {
                        "group_code": "aux",
                        "code": "SIG_IN",
                        "role": "signal",
                        "logical_type": "signal",
                        "direction": "in",
                        "source": "override",
                    }
                ],
            )
        )

        self.assertEqual(preview.interfaces[0].side, "top")

    def test_derived_interface_layout_override_is_used_by_preview(self):
        preview = derive_typical_preview(
            typical_payload(
                template_key="multi_pole_switch_device",
                parameter_definitions=[
                    {
                        "code": "power_topology",
                        "name": "Power topology",
                        "source": "library",
                        "input_type": "enum",
                        "default_value": "L",
                        "allowed_values": ["L"],
                        "drives_interfaces": True,
                    }
                ],
                interfaces=[
                    {
                        "code": "L_IN",
                        "role": "line_in",
                        "logical_type": "power",
                        "direction": "in",
                        "side": "top",
                        "side_order": 7,
                        "source": "derived",
                        "sort_order": 7,
                    }
                ],
            )
        )

        by_code = {interface.code: interface for interface in preview.interfaces}
        self.assertEqual(by_code["L_IN"].side, "top")
        self.assertEqual(by_code["L_IN"].side_order, 7)

    def test_duplicate_interface_codes_are_validation_errors(self):
        validation = validate_typical_payload(
            typical_payload(
                interfaces=[
                    {
                        "code": "A",
                        "role": "power",
                        "logical_type": "power",
                        "direction": "in",
                        "source": "override",
                    },
                    {
                        "code": "a",
                        "role": "power",
                        "logical_type": "power",
                        "direction": "out",
                        "source": "override",
                    },
                ]
            )
        )

        self.assertIn("duplicate_interface_code", {issue.code for issue in validation.issues})
        self.assertFalse(validation.valid)

    def test_unknown_interface_side_is_validation_error(self):
        validation = validate_typical_payload(
            typical_payload(
                interfaces=[
                    {
                        "code": "A",
                        "role": "power",
                        "logical_type": "power",
                        "direction": "in",
                        "side": "middle",
                        "source": "override",
                    }
                ]
            )
        )

        self.assertIn("invalid_interface_side", {issue.code for issue in validation.issues})
        self.assertFalse(validation.valid)

    def test_preview_reports_configuration_without_matches(self):
        preview = derive_typical_preview(
            typical_payload(
                parameter_definitions=[
                    {
                        "code": "mode",
                        "name": "Mode",
                        "source": "library",
                        "input_type": "enum",
                        "default_value": "B",
                        "allowed_values": ["A", "B"],
                        "drives_interfaces": True,
                    }
                ],
                interface_mapping_rules=[
                    {
                        "driver_parameter_code": "mode",
                        "driver_value": "A",
                        "interface_code": "A_OUT",
                        "role": "signal",
                        "logical_type": "signal",
                        "direction": "out",
                    }
                ],
            ),
            [TypicalDerivationParameterSelection(parameter_code="mode", selected_value="B")],
        )

        self.assertEqual(preview.origin_status, "no_matches")
        self.assertEqual(preview.interfaces, [])
        self.assertIn("no_derived_interfaces", {issue.code for issue in preview.validation_issues})

    def test_disabled_interface_is_removed_from_preview(self):
        preview = derive_typical_preview(
            typical_payload(
                template_key="multi_pole_switch_device",
                parameter_definitions=[
                    {
                        "code": "power_topology",
                        "name": "Power topology",
                        "source": "library",
                        "input_type": "enum",
                        "default_value": "L",
                        "allowed_values": ["L"],
                        "drives_interfaces": True,
                    }
                ],
                disabled_interface_codes=["L_IN"],
            )
        )

        self.assertNotIn("L_IN", {interface.code for interface in preview.interfaces})
        self.assertIn("L_OUT", {interface.code for interface in preview.interfaces})

    def test_disabled_interface_with_override_is_validation_error(self):
        validation = validate_typical_payload(
            typical_payload(
                disabled_interface_codes=["A"],
                interfaces=[
                    {
                        "code": "A",
                        "role": "signal",
                        "logical_type": "signal",
                        "direction": "out",
                        "source": "override",
                    }
                ],
            )
        )

        self.assertIn("disabled_interface_has_override", {issue.code for issue in validation.issues})
        self.assertFalse(validation.valid)

    def test_conflicting_explicit_interface_overrides_are_validation_errors(self):
        validation = validate_typical_payload(
            typical_payload(
                interfaces=[
                    {
                        "code": "A",
                        "role": "signal",
                        "logical_type": "signal",
                        "direction": "out",
                        "source": "override",
                    },
                    {
                        "code": "a",
                        "role": "signal",
                        "logical_type": "signal",
                        "direction": "out",
                        "source": "derived",
                    },
                ],
            )
        )

        self.assertIn("conflicting_interface_override", {issue.code for issue in validation.issues})
        self.assertFalse(validation.valid)

    def test_project_instance_derivation_carries_group_layout(self):
        interfaces = _derive_instance_interfaces(
            selections=[
                InstanceParameterSelection(
                    parameter_code="mode",
                    parameter_name="Mode",
                    selected_value="A",
                    sort_order=0,
                )
            ],
            rules=[
                InstanceInterfaceMappingRuleSnapshot(
                    driver_parameter_code="mode",
                    driver_value="A",
                    group_code="aux",
                    interface_code="SIG",
                    role="signal",
                    logical_type="signal",
                    direction="in",
                    sort_order=4,
                )
            ],
            groups=[
                InstanceInterfaceGroup(
                    code="aux",
                    name="Aux",
                    category="signal",
                    side="top",
                    sort_order=0,
                )
            ],
        )

        self.assertEqual(interfaces[0].side, "top")
        self.assertEqual(interfaces[0].side_order, 4)

    def test_project_instance_derivation_falls_back_without_layout_metadata(self):
        interfaces = _derive_instance_interfaces(
            selections=[
                InstanceParameterSelection(
                    parameter_code="mode",
                    parameter_name="Mode",
                    selected_value="A",
                    sort_order=0,
                )
            ],
            rules=[
                InstanceInterfaceMappingRuleSnapshot(
                    driver_parameter_code="mode",
                    driver_value="A",
                    group_code=None,
                    interface_code="OUT",
                    role="signal",
                    logical_type="signal",
                    direction="out",
                    sort_order=1,
                )
            ],
            groups=[],
        )

        self.assertEqual(interfaces[0].side, "right")


if __name__ == "__main__":
    unittest.main()
