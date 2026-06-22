"""RGM Copilot — an agentic layer over the RMM engines.

Uses Claude (via the official Anthropic SDK) as a tool-calling planner when an
API key is configured, and falls back to a deterministic intent router so the
copilot works with zero configuration.
"""
