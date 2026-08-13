# Signal: voice notes to structured action items (runs 100% locally)

Dictate or paste a rambling note and get back clean action-item cards —
task, owner, priority, due date — extracted by a local LLM via
[Ollama](https://ollama.com). Nothing leaves your machine.

## Setup

1. **Install Ollama** (if you haven't): https://ollama.com/download

2. **Pull a model** (llama3.2 is a good small/fast default):
   ```bash
   ollama pull llama3.2
   ```
   Ollama serves models automatically once pulled, but if it isn't already
   running you can start it explicitly:
   ```bash
   ollama serve
   ```

3. **Install Python dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

4. **Run the app:**
   ```bash
   python app.py
   ```

5. Open **http://localhost:5050** in Chrome or Edge (best support for mic
   dictation — the Web Speech API isn't available in every browser, but the
   textarea always works as a fallback).

## Using a different model

Open `app.py` and change:
```python
OLLAMA_MODEL = "llama3.2"
```
to any model you've pulled (`mistral`, `llama3.1`, `qwen2.5`, etc). Smaller
models respond faster; larger ones are more reliable at strict JSON output.

## Project structure

```
signal/
├── app.py              # Flask server + Ollama proxy + JSON extraction
├── requirements.txt
├── templates/
│   └── index.html      # Page shell
└── static/
    ├── style.css        # Visual design
    └── app.js           # Mic dictation + calls /extract
```

## How it works

1. You dictate (Web Speech API, browser-native) or paste a note.
2. The frontend POSTs the raw text to `/extract`.
3. Flask sends a prompt to your local Ollama instance asking for a strict
   JSON array of action items.
4. The response is parsed (with fallback regex extraction, since local
   models occasionally wrap JSON in prose) and rendered as cards.

## Troubleshooting

- **"Couldn't reach Ollama"** — make sure `ollama serve` is running and that
  you've pulled a model.
- **Model returns junk instead of JSON** — try a larger/more capable model,
  or lower `temperature` further in `app.py`.
- **Mic button is disabled** — your browser doesn't support the Web Speech
  API. Use Chrome or Edge, or just type/paste your note.
