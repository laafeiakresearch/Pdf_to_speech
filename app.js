class AIReader {
  constructor() {
    this.textContent = null;
    this.currentVoice = 'deep-male';
    this.isPlaying = false;
    this.playbackSpeed = 1;
    this.currentSentence = 0;
    this.currentWord = 0;
    this.showTranslation = false;
    this.synth = window.speechSynthesis;
    this.voices = [];
    
    this.init();
  }

  async init() {
    // Load voices
    this.loadVoices();
    
    // Event listeners
    this.bindEvents();
    
    // Theme toggle
    this.initTheme();
  }

  loadVoices() {
    const voices = [
      { id: 'deep-male', name: 'Deep Professional', icon: '👨‍💼', lang: 'en-US', voice: null },
      { id: 'clear-female', name: 'Clear Narrator', icon: '👩‍🏫', lang: 'en-US', voice: null },
      { id: 'young-male', name: 'Energetic Youth', icon: '🧑‍🎤', lang: 'en-GB', voice: null },
      { id: 'warm-female', name: 'Warm Storyteller', icon: '👩‍🎨', lang: 'en-AU', voice: null }
    ];
    
    this.voices = voices;
    this.renderVoices();
  }

  bindEvents() {
    const fileInput = document.getElementById('file-input');
    const textInput = document.getElementById('text-input');
    
    fileInput.addEventListener('change', (e) => this.handleFileUpload(e));
    textInput.addEventListener('input', (e) => this.handleTextInput(e));
    
    document.getElementById('play-btn').addEventListener('click', () => this.togglePlay());
    document.getElementById('lang-toggle-btn').addEventListener('click', () => this.toggleLanguage());
    
    document.querySelectorAll('.speed-btn').forEach(btn => {
      btn.addEventListener('click', (e) => this.setSpeed(e.target.dataset.speed));
    });
    
    document.querySelector('.theme-toggle').addEventListener('click', () => this.toggleTheme());
    
    // Drag & drop
    const uploadArea = document.getElementById('upload-area');
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
      uploadArea.addEventListener(eventName, (e) => this.preventDefaults(e), false);
    });
    
    ['dragenter', 'dragover'].forEach(eventName => {
      uploadArea.addEventListener(eventName, () => uploadArea.classList.add('dragover'), false);
    });
    
    ['dragleave', 'drop'].forEach(eventName => {
      uploadArea.addEventListener(eventName, () => uploadArea.classList.remove('dragover'), false);
    });
    
    uploadArea.addEventListener('drop', (e) => this.handleDrop(e), false);
  }

  preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
  }

  async handleFileUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    
    this.showLoading(true);
    
    try {
      let text = '';
      
      if (file.name.endsWith('.txt')) {
        text = await file.text();
      } else if (file.name.endsWith('.pdf')) {
        text = await this.extractPDFText(file);
      }
      
      await this.processText(text);
    } catch (error) {
      console.error('Error processing file:', error);
      alert('Error processing file. Please try again.');
    } finally {
      this.showLoading(false);
    }
  }

  async extractPDFText(file) {
    const arrayBuffer = await file.arrayBuffer();
    const pdfDoc = await PDFLib.PDFDocument.load(arrayBuffer);
    
    let fullText = '';
    const pages = await pdfDoc.getPages();
    
    for (let page of pages) {
      const textContent = page.node.textContent();
      if (textContent) fullText += textContent + '\n';
    }
    
    return fullText;
  }

  async handleTextInput(e) {
    if (e.target.value.trim()) {
      this.showLoading(true);
      await this.processText(e.target.value);
      this.showLoading(false);
    }
  }

  async processText(text) {
    const language = await this.detectLanguage(text);
    const sentences = text.split(/[.!?]+/).filter(s => s.trim()).slice(0, 50);
    
    this.textContent = {
      original: text,
      translated: text, // No real translation in static version
      language,
      sentences
    };
    
    this.showReaderPanel();
    this.renderText();
  }

  async detectLanguage(text) {
    // Simple heuristic detection
    const englishWords = ['the', 'and', 'for', 'are', 'but', 'not'];
    const wordCount = text.toLowerCase().split(/\s+/).filter(w => w.length > 3);
    
    const englishMatches = wordCount.filter(word => 
      englishWords.includes(word)
    ).length;
    
    return englishMatches > wordCount.length * 0.1 ? 'en' : 'non-en';
  }

  showReaderPanel() {
    document.getElementById('upload-panel').classList.add('hidden');
    document.getElementById('reader-panel').classList.remove('hidden');
  }

  renderVoices() {
    const grid = document.getElementById('voice-grid');
    grid.innerHTML = this.voices.map(voice => `
      <div class="voice-card ${this.currentVoice === voice.id ? 'active' : ''}" data-voice="${voice.id}">
        <div class="voice-icon">${voice.icon}</div>
        <div class="voice-name">${voice.name}</div>
        <div class="voice-desc">${voice.type || voice.lang}</div>
      </div>
    `).join('');
    
    // Voice selection
    document.querySelectorAll('.voice-card').forEach(card => {
      card.addEventListener('click', (e) => {
        this.selectVoice(e.currentTarget.dataset.voice);
      });
    });
  }

  selectVoice(voiceId) {
    this.currentVoice = voiceId;
    document.querySelectorAll('.voice-card').forEach(c => c.classList.remove('active'));
    document.querySelector(`[data-voice="${voiceId}"]`).classList.add('active');
    document.getElementById('voice-name').textContent = 
      this.voices.find(v => v.id === voiceId)?.name || '';
  }

  renderText() {
    const container = document.getElementById('text-container');
    const textToShow = this.showTranslation ? this.textContent.translated : this.textContent.original;
    
    container.innerHTML = this.textContent.sentences.map((sentence, idx) => {
      const words = sentence.split(' ');
      return `
        <div class="sentence" data-sentence="${idx}">
          ${words.map((word, wIdx) => 
            `<span class="word" data-word="${wIdx}">${word}</span>`
          ).join(' ')}
        </div>
      `;
    }).join('');
    
    // Sentence click handlers
    document.querySelectorAll('.sentence').forEach((sentence, idx) => {
      sentence.addEventListener('click', () => this.playSentence(idx));
    });
  }

  async playSentence(index) {
    this.currentSentence = index;
    const sentence = this.textContent.sentences[index];
    await this.speakText(sentence);
  }

  async speakText(text) {
    if (this.synth.speaking) {
      this.synth.cancel();
    }
    
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = this.playbackSpeed;
    
    // Select voice
    const voiceConfig = this.voices.find(v => v.id === this.currentVoice);
    const availableVoices = this.synth.getVoices();
    
    const voice = availableVoices.find(v => 
      v.lang.includes(voiceConfig?.lang || 'en')
    ) || availableVoices[0];
    
    if (voice) utterance.voice = voice;
    
    utterance.onstart = () => {
      this.isPlaying = true;
      this.updatePlayButton();
    };
    
    utterance.onend = () => {
      this.isPlaying = false;
      this.updatePlayButton();
    };
    
    utterance.onboundary = (event) => {
      if (event.name === 'word') {
        this.highlightWord(event.charIndex);
      }
    };
    
    this.synth.speak(utterance);
  }

  highlightWord(charIndex) {
    document.querySelectorAll('.word').forEach(word => {
      word.classList.remove('speaking');
    });
    
    // Simple word highlighting
    const words = document.querySelectorAll('.word');
    const wordIndex = Math.floor(charIndex / 5); // Approximate
    if (words[wordIndex]) {
      words[wordIndex].classList.add('speaking');
      words[wordIndex].scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  togglePlay() {
    if (this.isPlaying) {
      this.synth.cancel();
    } else if (this.currentSentence >= 0 && this.textContent) {
      this.playSentence(this.currentSentence);
    }
  }

  updatePlayButton() {
    const btn = document.getElementById('play-btn');
    btn.textContent = this.isPlaying ? '⏸️' : '▶️';
    btn.classList.toggle('playing', this.isPlaying);
  }

  setSpeed(speed) {
    this.playbackSpeed = parseFloat(speed);
    document.querySelectorAll('.speed-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelector(`[data-speed="${speed}"]`).classList.add('active');
    document.getElementById('speed-display').textContent = `${speed}x`;
  }

  toggleLanguage() {
    this.showTranslation = !this.showTranslation;
    const btn = document.getElementById('lang-toggle-btn');
    btn.textContent = this.showTranslation ? 'Original' : 'Translation';
    btn.classList.toggle('active');
    this.renderText();
  }

  toggleTheme() {
    document.body.classList.toggle('light');
    const isLight = document.body.classList.contains('light');
    document.querySelector('.sun-icon').style.display = isLight ? 'none' : 'block';
    document.querySelector('.moon-icon').style.display = isLight ? 'block' : 'none';
  }

  initTheme() {
    document.querySelector('.sun-icon').style.display = 'block';
    document.querySelector('.moon-icon').style.display = 'none';
  }

  showLoading(show) {
    document.getElementById('loading-overlay').classList.toggle('hidden', !show);
  }
}

// Global paste function
async function pasteText() {
  try {
    const text = await navigator.clipboard.readText();
    document.getElementById('text-input').value = text;
    app.handleTextInput({ target: { value: text } });
  } catch (err) {
    alert('Clipboard access failed. Please paste manually.');
  }
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  window.app = new AIReader();
  
  // Handle drop events
  document.getElementById('upload-area').addEventListener('drop', (e) => {
    e.preventDefault();
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      const file = files[0];
      const fileInput = document.getElementById('file-input');
      fileInput.files = files;
      app.handleFileUpload({ target: fileInput });
    }
  });
});
