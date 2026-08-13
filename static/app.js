const rawInput = document.getElementById('rawInput');
const micBtn = document.getElementById('micBtn');
const extractBtn = document.getElementById('extractBtn');
const clearBtn = document.getElementById('clearBtn');
const results = document.getElementById('results');
const emptyState = document.getElementById('emptyState');
const statusLine = document.getElementById('statusLine');
const micDot = document.getElementById('micDot');

let recognition = null;
let isRecording = false;

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
if (SpeechRecognition) {
  recognition = new SpeechRecognition();
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.lang = 'en-US';

  let finalTranscript = '';

  recognition.onstart = () => {
    isRecording = true;
    micBtn.textContent = '⏹ Stop dictation';
    micBtn.classList.add('recording');
    micDot.classList.add('live');
    finalTranscript = rawInput.value ? rawInput.value + ' ' : '';
  };

  recognition.onresult = (event) => {
    let interim = '';
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const transcript = event.results[i][0].transcript;
      if (event.results[i].isFinal) {
        finalTranscript += transcript + ' ';
      } else {
        interim += transcript;
      }
    }
    rawInput.value = finalTranscript + interim;
  };

  recognition.onerror = (event) => {
    statusLine.textContent = 'Mic error: ' + event.error + '. You can still type/paste text.';
    statusLine.classList.add('err');
    stopRecording();
  };

  recognition.onend = () => {
    if (isRecording) stopRecording();
  };
} else {
  micBtn.disabled = true;
  micBtn.textContent = '🎙 Dictation not supported here';
}

function stopRecording() {
  isRecording = false;
  micBtn.textContent = '🎙 Start dictation';
  micBtn.classList.remove('recording');
  micDot.classList.remove('live');
}

micBtn.addEventListener('click', () => {
  if (!recognition) return;
  if (isRecording) {
    recognition.stop();
    stopRecording();
  } else {
    statusLine.textContent = '';
    statusLine.classList.remove('err');
    recognition.start();
  }
});

clearBtn.addEventListener('click', () => {
  rawInput.value = '';
  results.innerHTML = '';
  results.appendChild(emptyState);
  statusLine.textContent = '';
  statusLine.classList.remove('err');
});

extractBtn.addEventListener('click', async () => {
  const text = rawInput.value.trim();
  if (!text) {
    statusLine.textContent = 'Add some text first — dictate or paste a note.';
    statusLine.classList.add('err');
    return;
  }
  statusLine.classList.remove('err');
  statusLine.textContent = 'Extracting via local Ollama model… (first run can be slow while it loads)';
  extractBtn.disabled = true;

  try {
    const response = await fetch('/extract', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text })
    });
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Extraction failed.');
    }

    const items = data.items || [];
    results.innerHTML = '';

    if (!items.length) {
      const div = document.createElement('div');
      div.className = 'empty-state';
      div.textContent = 'No clear action items found in that note.';
      results.appendChild(div);
    } else {
      items.forEach((item, i) => {
        const card = document.createElement('div');
        card.className = 'card';
        card.style.animationDelay = (i * 0.06) + 's';
        const priority = (item.priority || 'medium').toLowerCase();
        card.innerHTML = `
          <div class="card-top">
            <div class="card-task">${escapeHtml(item.task || '')}</div>
            <div class="badge ${priority}">${priority}</div>
          </div>
          <div class="card-meta">
            <span>👤 ${escapeHtml(item.owner || 'Unassigned')}</span>
            <span>📅 ${escapeHtml(item.due || 'No date')}</span>
          </div>
        `;
        results.appendChild(card);
      });
    }
    statusLine.textContent = `Extracted ${items.length} item${items.length === 1 ? '' : 's'}.`;
  } catch (err) {
    statusLine.textContent = err.message || 'Something went wrong extracting items.';
    statusLine.classList.add('err');
    console.error(err);
  } finally {
    extractBtn.disabled = false;
  }
});

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
