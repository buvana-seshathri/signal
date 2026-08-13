"""
Signal — voice notes to structured action items, powered by a local Ollama model.

Run:
    pip install -r requirements.txt
    ollama pull llama3.2          # or any model you prefer
    python app.py
Then open http://localhost:5050
"""

import json
import re

import requests
from flask import Flask, jsonify, render_template, request

app = Flask(__name__)

OLLAMA_URL = "http://localhost:11434/api/generate"
OLLAMA_MODEL = "llama3.2"  # change to whatever model you've pulled, e.g. "mistral", "llama3.1"

SYSTEM_PROMPT = (
    "You extract action items from rambling notes or transcripts. "
    'Respond with ONLY a JSON object of the form: {"items": [...]}, no preamble, '
    "no markdown fences, no commentary. "
    'Each entry in "items" must look like: {"task": string, "owner": string or null, '
    '"due": string or null, "priority": "high", "medium", or "low"}. '
    "Infer priority from tone/urgency words if it isn't explicit. "
    "Keep task text concise, under 12 words. "
    'If there are no clear action items, respond with {"items": []}.'
)


def extract_json_array(raw_text: str):
    """
    Pull the action-item array out of the model's response.
    Handles: a bare array, an {"items": [...]} object, JSON wrapped in prose
    or code fences, and (rarely) still-malformed output from weaker local models.
    """
    cleaned = raw_text.strip()
    cleaned = re.sub(r"^```(json)?", "", cleaned).strip()
    cleaned = re.sub(r"```$", "", cleaned).strip()

    parsed = None
    try:
        parsed = json.loads(cleaned)
    except json.JSONDecodeError:
        # Fallback: find the first {...} or [...] block in the text and try that instead
        match = re.search(r"\{.*\}|\[.*\]", cleaned, re.DOTALL)
        if match:
            try:
                parsed = json.loads(match.group(0))
            except json.JSONDecodeError:
                pass

    if parsed is None:
        raise ValueError(
            f"Model output wasn't valid JSON, even after cleanup. "
            f"Raw output started with: {raw_text[:200]!r}"
        )

    if isinstance(parsed, dict):
        if isinstance(parsed.get("items"), list):
            return parsed["items"]
        raise ValueError(f"Expected a JSON object with an \"items\" array, got: {parsed!r}")

    if isinstance(parsed, list):
        return parsed

    raise ValueError(f"Unexpected JSON shape from model: {parsed!r}")


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/extract", methods=["POST"])
def extract():
    body = request.get_json(force=True) or {}
    note = (body.get("text") or "").strip()

    if not note:
        return jsonify({"error": "No text provided."}), 400

    prompt = f"{SYSTEM_PROMPT}\n\nNote:\n{note}"

    try:
        resp = requests.post(
            OLLAMA_URL,
            json={
                "model": OLLAMA_MODEL,
                "prompt": prompt,
                "stream": False,
                "format": "json",  # constrains decoding to syntactically valid JSON
                "options": {"temperature": 0.2},
            },
            timeout=120,
        )
        resp.raise_for_status()
    except requests.exceptions.ConnectionError:
        return jsonify({
            "error": (
                "Couldn't reach Ollama at localhost:11434. "
                "Is Ollama running? Try `ollama serve` in another terminal."
            )
        }), 503
    except requests.exceptions.RequestException as e:
        return jsonify({"error": f"Ollama request failed: {e}"}), 502

    raw_output = resp.json().get("response", "")

    try:
        items = extract_json_array(raw_output)
    except ValueError as e:
        return jsonify({"error": str(e), "raw": raw_output}), 502

    if not isinstance(items, list):
        return jsonify({"error": "Model did not return a JSON array.", "raw": raw_output}), 502

    return jsonify({"items": items})


if __name__ == "__main__":
    app.run(debug=True, port=5050)
