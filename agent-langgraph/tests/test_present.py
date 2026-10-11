from agent.tools.present import present


def test_clock_and_status_codes_become_operator_language():
    raw = """
    {
      "items": [
        {
          "asset_id": "HX-204",
          "verdict": "inspection_failure",
          "action_type": "ACOUSTIC_INSPECTION",
          "measurement_type": "SOUND_DB",
          "cause": "TARGET_NOT_DETECTED",
          "severity": "CRITICAL",
          "updated_at": "2026-10-11T01:52:52.970679+00:00",
          "explanation": "Inspect thermal failed: TARGET_NOT_DETECTED."
        }
      ]
    }
    """
    text = present(raw)
    assert "HX-204" in text
    assert "inspection_failure" not in text
    assert "failed check" in text
    assert "target not detected" in text
    assert "acoustic inspection" in text
    assert "sound" in text
    assert "SOUND_DB" not in text
    assert "ACOUSTIC_INSPECTION" not in text
    assert "critical" in text
    assert "1:52am 10/11" in text
    assert "2026-10-11" not in text
