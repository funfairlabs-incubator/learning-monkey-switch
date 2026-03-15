/**
 * public/js/learn.js
 *
 * The authenticated study interface.
 *
 * Two modes per user role:
 *
 * ADULT: Enter a topic → Claude generates a structured study plan they can
 *        work through. Can also chat freely. Full access.
 *
 * CHILD: Enter a topic → Claude opens a Socratic conversation. Asks what
 *        they know already. Guides them through the topic. Refuses to write
 *        homework content. Parent overrides respected per topic slug.
 *
 * The persona system prompt (from personas.js) is prepended to every
 * conversation — it cannot be overridden by the user. The system prompt
 * is the contract, not the UI.
 */

(function () {

  // ── State ────────────────────────────────────────────────────────────────────

  let conversationHistory = [];
  let currentTopic        = null;
  let currentUser         = null;
  let isStreaming         = false;

  // ── DOM refs ─────────────────────────────────────────────────────────────────

  const topicForm    = document.getElementById('topic-form');
  const topicInput   = document.getElementById('topic-input');
  const chatArea     = document.getElementById('chat-area');
  const chatMessages = document.getElementById('chat-messages');
  const chatForm     = document.getElementById('chat-form');
  const chatInput    = document.getElementById('chat-input');
  const sendBtn      = document.getElementById('send-btn');
  const topicLabel   = document.getElementById('current-topic-label');
  const newTopicBtn  = document.getElementById('new-topic-btn');
  const childBanner  = document.getElementById('child-mode-banner');

  // ── Init — wait for auth ─────────────────────────────────────────────────────

  window.addEventListener('learn:auth', (e) => {
    currentUser = e.detail.user;
    initInterface();
  });

  function initInterface() {
    if (!currentUser) return;

    // Show child mode banner
    if (childBanner) {
      if (currentUser.role === 'child') {
        childBanner.style.display = 'flex';
        const yg = currentUser.year_group ? ` · ${currentUser.year_group}` : '';
        childBanner.querySelector('.banner-text').textContent =
          `Learning mode${yg} — Claude will guide your thinking, not do the work for you`;
      } else {
        childBanner.style.display = 'none';
      }
    }

    // Topic form submission
    if (topicForm) {
      topicForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const topic = topicInput?.value?.trim();
        if (topic) startTopic(topic);
      });
    }

    // Chat form submission
    if (chatForm) {
      chatForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const msg = chatInput?.value?.trim();
        if (msg && !isStreaming) sendMessage(msg);
      });
    }

    // New topic button
    if (newTopicBtn) {
      newTopicBtn.addEventListener('click', resetToTopicEntry);
    }

    // Auto-resize textarea
    if (chatInput) {
      chatInput.addEventListener('input', () => {
        chatInput.style.height = 'auto';
        chatInput.style.height = Math.min(chatInput.scrollHeight, 160) + 'px';
      });
    }
  }

  // ── Topic entry ──────────────────────────────────────────────────────────────

  async function startTopic(topicText) {
    currentTopic = topicText;
    conversationHistory = [];

    // Switch to chat view
    if (topicForm?.closest('.topic-entry')) {
      topicForm.closest('.topic-entry').style.display = 'none';
    }
    if (chatArea) chatArea.style.display = 'flex';
    if (topicLabel) topicLabel.textContent = topicText;
    if (chatMessages) chatMessages.innerHTML = '';

    // Determine topic slug for override check (normalise to lowercase-hyphen)
    const topicSlug = topicText.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    const hasOverride = window.learnAuth?.canOverride(topicSlug);

    // Build opening message based on persona
    let openingMessage;

    if (currentUser.role === 'adult') {
      openingMessage = `I'd like to explore: **${topicText}**

Please create a structured study guide I can work through. Include:
- Key concepts and why they matter
- A logical learning progression
- Suggested questions to test understanding
- Good free resources (UK-focused where relevant)`;
    } else {
      // Child — Socratic opening
      openingMessage = `I want to learn about: ${topicText}`;
    }

    await sendMessage(openingMessage, true);
  }

  function resetToTopicEntry() {
    currentTopic = null;
    conversationHistory = [];
    if (topicForm?.closest('.topic-entry')) {
      topicForm.closest('.topic-entry').style.display = '';
    }
    if (chatArea) chatArea.style.display = 'none';
    if (topicInput) { topicInput.value = ''; topicInput.focus(); }
  }

  // ── Message handling ─────────────────────────────────────────────────────────

  async function sendMessage(text, isOpening = false) {
    if (!currentUser || isStreaming) return;

    // Add to history
    conversationHistory.push({ role: 'user', content: text });

    // Render user bubble (not for silent opening on adult plan generation)
    if (!isOpening || currentUser.role === 'child') {
      appendMessage('user', text);
    }

    // Clear input
    if (chatInput) { chatInput.value = ''; chatInput.style.height = 'auto'; }

    // Show typing indicator
    const typingEl = appendTyping();
    isStreaming = true;
    if (sendBtn) sendBtn.disabled = true;

    try {
      const reply = await callClaude(conversationHistory);

      // Remove typing indicator, add assistant message
      typingEl.remove();
      appendMessage('assistant', reply);
      conversationHistory.push({ role: 'assistant', content: reply });

    } catch (err) {
      typingEl.remove();
      appendMessage('error', `Something went wrong: ${err.message}. Please try again.`);
      // Remove the failed user message from history
      conversationHistory.pop();
    } finally {
      isStreaming = false;
      if (sendBtn) sendBtn.disabled = false;
      if (chatInput) chatInput.focus();
    }
  }

  // ── Claude API call ──────────────────────────────────────────────────────────

  async function callClaude(history) {
    const topicSlug    = currentTopic?.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') || '';
    const hasOverride  = window.learnAuth?.canOverride(topicSlug);
    const PERSONAS     = window.PERSONAS;

    let systemPrompt;
    if (currentUser.role === 'adult') {
      systemPrompt = PERSONAS.adult(currentUser);
    } else if (hasOverride) {
      systemPrompt = PERSONAS.child_unlocked(currentUser, currentTopic);
    } else {
      systemPrompt = PERSONAS.child(currentUser);
    }

    // Call via Cloudflare Worker proxy — API key never exposed in browser
    const proxyUrl = window.LEARN_CONFIG?.proxyUrl || 'https://learn-proxy.funfairlabs.com/chat';
    const response = await fetch(proxyUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model:      'claude-sonnet-4-20250514',
        max_tokens: 1500,
        system:     systemPrompt,
        messages:   history,
      }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error?.message || `API error ${response.status}`);
    }

    const data = await response.json();
    const text = data.content?.filter(b => b.type === 'text').map(b => b.text).join('') || '';
    if (!text) throw new Error('Empty response from Claude');
    return text;
  }

  // ── Rendering ────────────────────────────────────────────────────────────────

  function appendMessage(role, text) {
    if (!chatMessages) return;

    const el = document.createElement('div');
    el.className = `message message--${role}`;

    if (role === 'assistant') {
      el.innerHTML = `
        <div class="message-avatar">◆</div>
        <div class="message-body">${renderMarkdown(text)}</div>
      `;
    } else if (role === 'user') {
      el.innerHTML = `<div class="message-body message-body--user">${escapeHtml(text)}</div>`;
    } else {
      el.innerHTML = `<div class="message-body message-body--error">${escapeHtml(text)}</div>`;
    }

    chatMessages.appendChild(el);
    el.scrollIntoView({ behavior: 'smooth', block: 'end' });
    return el;
  }

  function appendTyping() {
    if (!chatMessages) return { remove: () => {} };
    const el = document.createElement('div');
    el.className = 'message message--assistant message--typing';
    el.innerHTML = `
      <div class="message-avatar">◆</div>
      <div class="message-body">
        <span class="typing-dot"></span>
        <span class="typing-dot"></span>
        <span class="typing-dot"></span>
      </div>
    `;
    chatMessages.appendChild(el);
    el.scrollIntoView({ behavior: 'smooth', block: 'end' });
    return el;
  }

  // Minimal safe markdown renderer
  function renderMarkdown(text) {
    return text
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      // Code blocks
      .replace(/```[\w]*\n?([\s\S]*?)```/g, '<pre><code>$1</code></pre>')
      // Inline code
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      // Bold
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      // Italic
      .replace(/\*([^*]+)\*/g, '<em>$1</em>')
      // Headings
      .replace(/^### (.+)$/gm, '<h3>$1</h3>')
      .replace(/^## (.+)$/gm, '<h2>$1</h2>')
      // Unordered list items
      .replace(/^[-•] (.+)$/gm, '<li>$1</li>')
      // Numbered list items
      .replace(/^\d+\. (.+)$/gm, '<li>$1</li>')
      // Wrap consecutive li elements
      .replace(/(<li>[\s\S]*?<\/li>)(\n<li>[\s\S]*?<\/li>)*/g, m => `<ul>${m}</ul>`)
      // Paragraphs
      .replace(/\n\n(?!<[hul]|<pre)/g, '</p><p>')
      .replace(/^(?!<[hupol])(.+)$/gm, (m) => m.startsWith('<') ? m : m)
      // Clean up
      .replace(/<\/ul>\s*<ul>/g, '')
      .trim();
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

})();
