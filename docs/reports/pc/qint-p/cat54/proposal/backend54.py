"""Prompt-only backend extension; inherits the pinned load/generate/drain code."""
from runner import SelectedBackend


class AnalysisBackend54(SelectedBackend):
    def prompt_for(self, attempt):
        from assessment54 import prompt
        return prompt(attempt)
