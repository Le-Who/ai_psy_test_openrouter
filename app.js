/**
 * AI Universal Test Generator - Core Logic v6.0 (Final UI/UX Polish)
 * Features: Glassmorphism support, Clipboard API, Confetti, Toast Notifications
 */

const TINY_TOKEN = 'lBjFvZGQQmPD56gcBpQBgdyMlezZCxwNShVIlh9wA3W4HFtDOI0418CnoXBx'; 

const api = {
    detectProvider(key) { return key.startsWith('AIza') ? 'gemini' : 'openrouter'; },
    safeParseJSON(text) { try { return JSON.parse(text); } catch (e) { const match = text.match(/(\{[^]*\}|\[[^]*\])/); if (match) try { return JSON.parse(match[0]); } catch (e2) {} const mdMatch = text.match(/```(?:json)?\s*([^]*?)\s*```/); if (mdMatch) try { return JSON.parse(mdMatch[1]); } catch (e3) {} throw new Error("JSON Parse Error"); } },
    async call(task, prompt, schema, key) { const provider = this.detectProvider(key); const sysPrompt = PROMPTS[provider][task]; console.log(`📡 API: ${provider} -> ${task}`); if (provider === 'gemini') return this.callGemini(sysPrompt, prompt, schema, 'generator', key); return this.callOpenRouter(sysPrompt, prompt, schema, 'generator', key); },
    async callOpenRouter(sys, user, schema, type, key) { const model = CONFIG.providers.openrouter.models[type]; const messages = [{ role: 'system', content: sys }, { role: 'user', content: user }]; const res = await fetch(CONFIG.providers.openrouter.endpoint, { method: 'POST', headers: CONFIG.providers.openrouter.headers(key), body: JSON.stringify({ model, messages, response_format: { type: "json_object" }, temperature: 0.7 }) }); const data = await res.json(); return this.safeParseJSON(data.choices[0].message.content); },
    async callGemini(sys, user, schema, type, key) { const model = CONFIG.providers.gemini.models[type]; const prompt = `${sys}\n\nFORMAT JSON:\n${JSON.stringify(schema)}\n\nTASK: ${user}`; const res = await fetch(`${CONFIG.providers.gemini.endpoint}${model}:generateContent?key=${key}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }) }); const data = await res.json(); return this.safeParseJSON(data.candidates[0].content.parts[0].text); }
};

const app = {
    state: {
        step: 0,
        mode: 'psy',        // 'psy' | 'quiz' | 'duel'
        answers: [],
        questions: [],
        blueprint: null,
        quizScore: 0,
        duelHostName: null,
        duelHostScore: null,
        duelHostResultName: null
    },

    init() {
        // Восстанавливаем API ключ для удобства
        const savedKey = localStorage.getItem('user_api_key');
        if (savedKey) {
            const input = document.getElementById('apiKeyInput');
            if (input) input.value = savedKey;
        }

        this.checkHash();
        window.onpopstate = () => { history.replaceState(null, document.title, window.location.pathname); location.reload(); };
    },

    // Нормализация mapping для психо-тестов в соответствии с архитектурными правилами
    normalizePsyQuestions(questions) {
        const ALLOWED_WEIGHTS = [-2.0, -1.0, -0.5, 0.5, 1.0, 2.0];
        const snapWeight = (w) => {
            const num = Number(w);
            if (!Number.isFinite(num)) return 1.0;
            let best = ALLOWED_WEIGHTS[0];
            let bestDiff = Math.abs(num - best);
            for (let i = 1; i < ALLOWED_WEIGHTS.length; i++) {
                const d = Math.abs(num - ALLOWED_WEIGHTS[i]);
                if (d < bestDiff) {
                    bestDiff = d;
                    best = ALLOWED_WEIGHTS[i];
                }
            }
            return best;
        };

        if (!Array.isArray(questions)) return questions;
        return questions.map((q) => {
            if (!q || !Array.isArray(q.mapping)) return q;

            let mapping = q.mapping
                .filter(m => m && typeof m.outcomeId === 'string')
                .map(m => {
                    const weight = snapWeight(m.weight);
                    return { ...m, weight };
                });

            if (mapping.length === 0) return q;

            if (mapping.length > 2) {
                mapping.sort((a, b) => Math.abs(b.weight) - Math.abs(a.weight));
                mapping = mapping.slice(0, 2);
            }

            // Авто-вывод polarity, если не задана моделью
            if (!q.polarity) {
                const hasPos = mapping.some(m => m.weight > 0);
                const hasNeg = mapping.some(m => m.weight < 0);
                let polarity = 'direct';
                if (hasPos && hasNeg) polarity = 'mixed';
                else if (hasNeg && !hasPos) polarity = 'reverse';
                q.polarity = polarity;
            }

            return { ...q, mapping };
        });
    },

    // --- UI HELPER: TOAST ---
    showToast(message) {
        const x = document.getElementById("toast");
        if (!x) return; // Если элемент еще не добавлен в HTML
        x.innerText = message;
        x.className = "show";
        setTimeout(function() { x.className = x.className.replace("show", ""); }, 3000);
    },

    // --- ЛОГИКА SHARING / DUEL ---
    checkHash() {
        if (window.location.hash.startsWith('#d=')) {
            try {
                if (typeof LZString === 'undefined') throw new Error("LZString library not loaded");
                const compressed = window.location.hash.substring(3);
                const decompressed = LZString.decompressFromEncodedURIComponent(compressed);
                const data = JSON.parse(decompressed);

                if (data && data.t && data.q) {
                    this.state.mode = 'duel';
                    this.state.blueprint = data.t;
                    this.state.questions = data.q;
                    this.state.duelHostName = data.h || "Аноним";
                    this.state.duelHostScore = data.s || 0;
                    this.state.duelHostResultName = data.r || null;

                    this.showDuelIntro();
                }
            } catch (e) {
                console.error("Link Error:", e);
                window.location.hash = "";
            }
        }
    },

    showDuelIntro() {
        document.getElementById('setupView').style.display = 'none';
        const dv = document.getElementById('duelView');
        const isQuiz = (this.state.blueprint.testType === 'quiz');

        const title = isQuiz ? "ВЫЗОВ ПРИНЯТ! ⚔️" : "СМОТРИ МОЙ РЕЗУЛЬТАТ! 👀";
        let desc = "";

        if (isQuiz) {
            desc = `Пользователь <strong style="color:#fff;">${this.state.duelHostName}</strong> набрал <strong style="color:var(--accent);">${this.state.duelHostScore}</strong> баллов.<br>Сможешь его победить?`;
        } else {
            const resultText = this.state.duelHostResultName ? `Ему выпало: <strong style="color:var(--accent);">${this.state.duelHostResultName}</strong>` : "Он уже прошел этот тест.";
            desc = `Пользователь <strong style="color:#fff;">${this.state.duelHostName}</strong> прошел тест.<br>${resultText}<br>А кто ты?`;
        }

        const dvH1 = dv.querySelector('h1');
        if(dvH1) dvH1.innerText = title;
        
        const dvP = dv.querySelector('p');
        if(dvP) dvP.innerHTML = desc;

        document.getElementById('duelThemeTitle').innerText = this.state.blueprint.theme || "Тест";
        document.getElementById('duelQCount').innerText = this.state.questions.length;
        
        dv.style.display = 'block';
    },

    startDuelTest() {
        document.getElementById('duelView').style.display = 'none';
        this.state.step = 0;
        this.state.answers = [];
        this.state.quizScore = 0;
        
        const type = this.state.blueprint.testType || 'categorical';
        if (type === 'quiz') {
            this.state.mode = 'duel';
        } else {
            this.state.mode = 'psy';
        }
        
        this.renderQ();
        this.setView('test');
    },

    // --- UI & LIBRARY ---
    openLibrary() {
        this.setView('library');
        document.getElementById('libraryContent').innerHTML = Storage.renderLibraryHTML();
    },
    closeLibrary() { this.setView('setup'); },

    setMode(mode) {
        this.state.mode = mode;
        document.getElementById('tabPsy').classList.toggle('active', mode === 'psy');
        document.getElementById('tabQuiz').classList.toggle('active', mode === 'quiz');
        document.getElementById('audienceGroup').style.display = mode === 'psy' ? 'block' : 'none';
        document.getElementById('difficultyGroup').style.display = mode === 'quiz' ? 'block' : 'none';
        document.getElementById('themeInput').placeholder = mode === 'psy' ? "Например: Кто ты из Вселенной Гарри Поттера?" : "Например: Знаток географии Европы";
    },

    async start(e) {
        if(e) e.preventDefault();
        this.state.step = 0;
        this.state.answers = [];
        this.state.quizScore = 0;
        this.state.blueprint = null;
        this.state.questions = [];
        this.state.duelHostName = null;

        const apiKey = document.getElementById('apiKeyInput').value.trim();
        const theme = document.getElementById('themeInput').value;
        const notes = document.getElementById('notesInput').value;
        const count = document.getElementById('qCountInput').value;
        
        if(!apiKey) return alert("Введите API ключ!");
        
        // Сохраняем ключ
        localStorage.setItem('user_api_key', apiKey);

        const isQuiz = this.state.mode === 'quiz';
        const contextParam = isQuiz ? `Сложность: ${document.getElementById('difficultyInput').value}` : `Аудитория: ${document.getElementById('audienceInput').value}`;
        const taskSuffix = isQuiz ? '_quiz' : '_psy';
        
        this.setLoading(true, "🧠 Проектируем тест...");
        document.getElementById('errorBox').style.display = 'none';

        try {
            const archPrompt = `Тема: "${theme}". ${contextParam}. ${notes ? `Уточнения: "${notes}".` : ""} Создай структуру.`;
            this.state.blueprint = await api.call('architect' + taskSuffix, archPrompt, (isQuiz ? SCHEMAS.quiz_blueprint : SCHEMAS.psy_blueprint), apiKey);
            this.state.blueprint.theme = theme; 

            this.setLoading(true, "✍️ Пишем вопросы...");
            const optionsCount = isQuiz ? document.getElementById('difficultyInput').value : 0;
            const genPrompt = `Тема: ${theme}. Структура: ${JSON.stringify(this.state.blueprint.outcomes)}. Кол-во вопросов: ${count}. ${isQuiz ? `ВАЖНО: ${optionsCount} варианта ответа в каждом вопросе!` : ""} ${notes}`;
            
            const res = await api.call('generator' + taskSuffix, genPrompt, (isQuiz ? SCHEMAS.quiz_questions : SCHEMAS.psy_questions), apiKey);
            
            const hasNestedQuestions = res && typeof res === 'object' && Array.isArray(res.questions);
            this.state.questions = hasNestedQuestions ? res.questions : res;
            if (hasNestedQuestions) {
                if (res.meta) this.state.blueprint.meta = res.meta;
                if (res.scaleProfile) this.state.blueprint.scaleProfile = res.scaleProfile;
                if (Array.isArray(res.outcomes) && res.outcomes.length) this.state.blueprint.outcomes = res.outcomes;
            }

            // Нормализация mapping для психо-тестов: максимум 2 outcomes на вопрос,
            // приведение весов к допустимым значениям (Soft Weights).
            if (!isQuiz && Array.isArray(this.state.questions)) {
                this.state.questions = this.normalizePsyQuestions(this.state.questions);
            }
            
            this.setLoading(false);
            this.renderQ();
            this.setView('test');
        } catch (err) {
            console.error(err);
            this.setLoading(false);
            document.getElementById('errorBox').style.display = 'block';
            document.getElementById('errorBox').innerHTML = `Ошибка: ${err.message}`;
            this.setView('setup');
        }
    },

    // --- RENDER QUESTIONS ---
    renderQ() {
        const q = this.state.questions[this.state.step];
        const total = this.state.questions.length;
        const isQuizMode = (this.state.mode === 'quiz' || (this.state.mode === 'duel' && this.state.blueprint.testType === 'quiz'));

        document.getElementById('qNum').innerText = `${this.state.step + 1} / ${total}`;
        document.getElementById('qText').innerText = q.text;
        document.getElementById('progressBar').style.width = ((this.state.step / total) * 100) + '%';
        
        const backBtn = document.getElementById('backBtn');
        backBtn.style.visibility = (!isQuizMode && this.state.step > 0) ? 'visible' : 'hidden';

        const psyDiv = document.getElementById('psyContainer');
        const quizDiv = document.getElementById('quizContainer');

        if (isQuizMode) {
            psyDiv.style.display = 'none';
            quizDiv.style.display = 'flex';
            
            let html = '';
            q.options.forEach((opt, idx) => {
                html += `<button class="quiz-opt" onclick="app.handleQuizAnswer(${idx}, this)">${opt}</button>`;
            });
            quizDiv.innerHTML = html;
        } else {
            psyDiv.style.display = 'grid';
            quizDiv.style.display = 'none';
            
            const btns = psyDiv.querySelectorAll('.likert-opt'); 
            btns.forEach(b => b.classList.remove('selected'));
            const prevAns = this.state.answers[this.state.step];
            if (prevAns !== undefined && btns[prevAns-1]) btns[prevAns-1].classList.add('selected');
        }
    },

    answer(val) {
        this.state.answers[this.state.step] = parseInt(val);
        const btns = document.getElementById('psyContainer').querySelectorAll('.likert-opt');
        btns.forEach(b => b.classList.remove('selected'));
        if(btns[val-1]) btns[val-1].classList.add('selected');
        setTimeout(() => this.nextQuestion(), 300);
    },

    handleQuizAnswer(idx, btn) {
        const q = this.state.questions[this.state.step];
        const isCorrect = (idx === q.correctIndex);
        if (isCorrect) { btn.classList.add('correct'); this.state.quizScore++; }
        else { 
            btn.classList.add('wrong');
            const allBtns = document.querySelectorAll('.quiz-opt');
            if(allBtns[q.correctIndex]) allBtns[q.correctIndex].classList.add('correct');
        }
        
        document.querySelectorAll('.quiz-opt').forEach(b => {
             b.classList.add('disabled');
             b.disabled = true;
        });

        setTimeout(() => this.nextQuestion(), 1200); 
    },

    nextQuestion() {
        if (this.state.step < this.state.questions.length - 1) {
            this.state.step++;
            this.renderQ();
        } else {
            this.calc();
            this.setView('results');
        }
    },
    
    prevQuestion() {
        if (this.state.step > 0) {
            this.state.step--;
            this.renderQ();
        }
    },

    // --- CALC RESULTS ---
    calc() {
        const getBaseScore = (ans, baseScoreMap) => {
            const a = (ans !== undefined && ans !== null) ? Number(ans) : 3;
            if (baseScoreMap && typeof baseScoreMap === 'object') {
                const v = baseScoreMap[String(a)];
                if (typeof v === 'number' && Number.isFinite(v)) return v;
            }
            return (a - 1) * 2.5;
        };

        const pickBandLabel = (bands, percent) => {
            if (!bands) return null;
            if (Array.isArray(bands)) {
                for (const b of bands) {
                    if (!b || typeof b !== 'object') continue;
                    const min = (typeof b.min === 'number') ? b.min : (typeof b.from === 'number' ? b.from : null);
                    const max = (typeof b.max === 'number') ? b.max : (typeof b.to === 'number' ? b.to : null);
                    if (min === null || max === null) continue;
                    if (percent >= min && percent <= max) return b.label || b.name || b.title || null;
                }
                return null;
            }
            if (typeof bands === 'object') {
                for (const key of Object.keys(bands)) {
                    const b = bands[key];
                    if (!b || typeof b !== 'object') continue;
                    const min = (typeof b.min === 'number') ? b.min : (typeof b.from === 'number' ? b.from : null);
                    const max = (typeof b.max === 'number') ? b.max : (typeof b.to === 'number' ? b.to : null);
                    if (min === null || max === null) continue;
                    if (percent >= min && percent <= max) return b.label || b.name || key;
                }
            }
            return null;
        };

        const outcomes = this.state.blueprint.outcomes;
        const container = document.getElementById('resContent');
        let html = '';
        let winningResultName = "";

        // 1. ВИКТОРИНА (или Дуэль)
        if (this.state.mode === 'quiz' || (this.state.mode === 'duel' && this.state.blueprint.testType === 'quiz')) {
            const score = this.state.quizScore;
            const total = this.state.questions.length;
            let result = outcomes.find(o => score >= o.minScore && score <= o.maxScore) || outcomes[0];
            winningResultName = result.name;

            let duelBlock = '';
            if (this.state.mode === 'duel') {
                const hostScore = this.state.duelHostScore;
                const hostName = this.state.duelHostName;
                let verdict = "", color = "";
                if (score > hostScore) { verdict = "ТЫ ПОБЕДИЛ! 🏆"; color = "#4caf50"; }
                else if (score === hostScore) { verdict = "НИЧЬЯ! 🤝"; color = "#ffd700"; }
                else { verdict = "ТЫ ПРОИГРАЛ... 💀"; color = "#f44336"; }
                duelBlock = `<div style="background:rgba(255,255,255,0.1); padding:15px; border-radius:12px; margin:20px 0; border:1px solid rgba(255,255,255,0.2);">
                    <h3 style="margin:0 0 10px; color:${color};">${verdict}</h3>
                    <div style="display:flex; justify-content:space-around;"><div>👤 Ты: <strong>${score}</strong></div><div>🆚 ${hostName}: <strong>${hostScore}</strong></div></div>
                </div>`;
            }

            html = `<div style="text-align:center;">
                <div style="font-size:14px; color:var(--text-muted); margin-bottom:10px;">ТВОЙ РЕЗУЛЬТАТ</div>
                <h1 style="font-size:56px; margin:0; color:var(--primary);">${score} <span style="font-size:24px; color:var(--text-muted);">/ ${total}</span></h1>
                ${duelBlock}
                <h2 style="margin:15px 0 20px;">${result.name}</h2>
                <p style="font-size:18px;">${result.description}</p>
            </div>`;

        } else {
            // 2. ПСИХОЛОГИЧЕСКИЙ ТЕСТ
            const scores = {};
            const scaleProfile = this.state.blueprint.scaleProfile || null;
            const baseScoreMap = scaleProfile && scaleProfile.baseScoreMap ? scaleProfile.baseScoreMap : null;
            const interpretationBands = scaleProfile && scaleProfile.interpretationBands ? scaleProfile.interpretationBands : null;

            // Структурные метрики + потенциалы вычисляем ДЕТЕРМИНИРОВАННО (не доверяем модели)
            const potential = {};
            const structure = {};
            outcomes.forEach(o => {
                scores[o.id] = 0;
                potential[o.id] = { minRaw: 0, maxRaw: 0 };
                structure[o.id] = {
                    sumAbsWeight: 0,
                    numItems: 0,
                    numReverseItems: 0,
                    numTwoOutcomeItems: 0
                };
            });

            // Вычисляем реальные minRaw/maxRaw и структуру
            this.state.questions.forEach((q, idx) => {
                const ans = this.state.answers[idx] !== undefined ? this.state.answers[idx] : 3;
                const baseScore = getBaseScore(ans, baseScoreMap);
                if (!q.mapping) return;
                const mappingLen = q.mapping.length;
                q.mapping.forEach(m => {
                    if (scores[m.outcomeId] === undefined) return;
                    const weight = m.weight || 1;
                    const absW = Math.abs(weight);
                    const polarity = weight > 0 ? 1 : -1;
                    const finalScore = polarity === 1 ? baseScore : (10 - baseScore);

                    // Счёт на основе ответов
                    scores[m.outcomeId] += finalScore * absW;

                    // Потенциал по вопросу: 0..10 * |w| (reverse — тоже 0..10)
                    potential[m.outcomeId].minRaw += 0;
                    potential[m.outcomeId].maxRaw += 10 * absW;

                    // Структура
                    const s = structure[m.outcomeId];
                    s.sumAbsWeight += absW;
                    s.numItems += 1;
                    if (weight < 0) s.numReverseItems += 1;
                    if (mappingLen === 2) s.numTwoOutcomeItems += 1;
                });
            });

            // Нормализация: только на наших потенциалах (никаких minRaw/maxRaw от LLM)
            const percentages = {};
            outcomes.forEach(o => {
                const minRaw = potential[o.id].minRaw;
                const maxRaw = potential[o.id].maxRaw;
                const denom = (maxRaw - minRaw);
                if (denom > 0) {
                    percentages[o.id] = Math.max(0, Math.min(100, Math.round(((scores[o.id] - minRaw) / denom) * 100)));
                } else {
                    percentages[o.id] = 0;
                }
            });

            // Диагностика (опирается только на локальные расчёты; qualityChecks показываем как текст, если есть)
            let diagnosticsHtml = '';
            {
                const qcText = scaleProfile && scaleProfile.qualityChecks ? (() => {
                    try { return JSON.stringify(scaleProfile.qualityChecks, null, 2); }
                    catch { return String(scaleProfile.qualityChecks); }
                })() : null;

                diagnosticsHtml += `<div class="diag-card">
                    <details>
                        <summary class="diag-summary">🔬 Диагностика шкал (для автора)</summary>
                        <div class="diag-body">
                            <div class="diag-outcomes">`;

                outcomes.forEach(o => {
                    const pct = percentages[o.id] ?? 0;
                    const band = pickBandLabel(interpretationBands, pct);
                    const st = structure[o.id];
                    const revPct = st.numItems > 0 ? Math.round((st.numReverseItems / st.numItems) * 100) : 0;
                    const twoOutPct = st.numItems > 0 ? Math.round((st.numTwoOutcomeItems / st.numItems) * 100) : 0;
                    diagnosticsHtml += `
                        <div class="diag-row">
                            <div class="diag-row-main">
                                <div class="diag-title">${o.name}</div>
                                <div class="diag-sub"><span>${pct}%${band ? ` • ${band}` : ``}</span></div>
                            </div>
                            <div class="diag-meta">
                                <span class="diag-pill">∑|w|: ${st.sumAbsWeight.toFixed(2)}</span>
                                <span class="diag-pill">items: ${st.numItems}</span>
                                <span class="diag-pill">reverse: ${st.numReverseItems} (${revPct}%)</span>
                                <span class="diag-pill">2-outcome: ${twoOutPct}%</span>
                            </div>
                        </div>`;
                });

                diagnosticsHtml += `</div>`;
                if (qcText) {
                    diagnosticsHtml += `
                        <div class="diag-qc">
                            <div class="diag-qc-title">qualityChecks (self-report LLM)</div>
                            <pre class="diag-code">${qcText}</pre>
                        </div>`;
                }
                diagnosticsHtml += `</div></details></div>`;
            }

            if (this.state.blueprint.testType !== 'dimensional') {
                const sorted = outcomes.sort((a,b) => scores[b.id] - scores[a.id]);
                const win = sorted[0];
                winningResultName = win.name;
                const band = pickBandLabel(interpretationBands, percentages[win.id]);

                html = `<div style="text-align:center; padding-bottom: 20px;">
                    <div style="font-size:12px; text-transform:uppercase; color:var(--text-muted); margin-bottom:10px;">Твой результат</div>
                    <h2 style="font-size:32px; margin:0 0 10px; color:var(--primary);">${win.name}</h2>
                    <p style="font-size:18px; line-height:1.6;">${win.description}</p>
                    <div style="margin-top:15px; font-size:28px; color:var(--accent); font-weight:bold;">${percentages[win.id]}% совпадение</div>
                    ${band ? `<div style="margin-top:8px; color:var(--text-muted); font-weight:600;">Интерпретация: ${band}</div>` : ``}
                </div>
                
                <div class="results-secondary-block">
                    <h4 class="results-secondary-title">Другие варианты:</h4>`;
                
                sorted.slice(1).forEach(o => {
                    const pct = percentages[o.id];
                    html += `
                    <div class="res-item">
                        <div style="display:flex; justify-content:space-between; font-size:14px; margin-bottom:5px;">
                            <span><strong>${o.name}</strong></span>
                            <span style="color:var(--primary); font-weight:600; font-size:15px;">${pct}%</span>
                        </div>
                        <div class="res-bar-bg"><div class="res-bar-fill" style="width:${pct}%"></div></div>
                    </div>`;
                });
                html += `</div>`;
                html += diagnosticsHtml;

            } else {
                html = `<div style="text-align:center; margin-bottom:25px;"><h2>Ваш профиль</h2></div>`;
                outcomes.forEach(o => {
                    const pct = percentages[o.id];
                    let interpText = '';
                    if (typeof o.highInterpretation === 'string' && typeof o.lowInterpretation === 'string') {
                        if (pct >= 70) interpText = o.highInterpretation;
                        else if (pct <= 30) interpText = o.lowInterpretation;
                        else if (typeof o.description === 'string') interpText = o.description;
                    } else if (typeof o.description === 'string') {
                        interpText = o.description;
                    }
                    html += `<div class="res-item">
                        <div style="display:flex; justify-content:space-between; margin-bottom:5px;">
                            <strong>${o.name}</strong>
                            <span style="color:var(--primary); font-weight:600; font-size:16px;">${pct}%</span>
                        </div>
                        <div class="res-bar-bg"><div class="res-bar-fill" style="width:${pct}%"></div></div>
                        ${interpText ? `<div style="margin-top:6px; font-size:13px; color:var(--text-muted);">${interpText}</div>` : ``}
                    </div>`;
                });
                html += diagnosticsHtml;
            }
        }
        
        this.state.lastResultName = winningResultName;

        const isQuiz = (this.state.mode === 'quiz' || (this.state.mode === 'duel' && this.state.blueprint.testType === 'quiz'));
        const shareBtnText = isQuiz ? "⚔️ Бросить вызов" : "📤 Поделиться результатом";

        // Добавлен класс btn-accent
        html += `
        <div style="display:flex; gap:10px; flex-wrap:wrap; justify-content:center; margin-top:30px;">
            <button id="saveTestBtn" class="btn" onclick="app.saveTest()" style="flex:1;">💾 Сохранить</button>
            <button id="shareBtn" class="btn btn-accent" onclick="app.createShareLink()" style="flex:1;">${shareBtnText}</button>
        </div>`;
        
        container.innerHTML = html;

        // --- MIKRO-INTERACTION: CONFETTI ---
        if (typeof confetti === 'function') {
            confetti({
                particleCount: 150,
                spread: 70,
                origin: { y: 0.6 },
                colors: ['#6366f1', '#ec4899', '#06b6d4', '#ffd700']
            });
            setTimeout(() => {
                confetti({ particleCount: 50, angle: 60, spread: 55, origin: { x: 0 } });
                confetti({ particleCount: 50, angle: 120, spread: 55, origin: { x: 1 } });
            }, 400);
        }
    },

    async createShareLink() {
        if(!TINY_TOKEN) return alert("Нужен TinyURL Token!");
        
        const btn = document.getElementById('shareBtn');
        const originalText = btn.innerHTML;
        btn.innerHTML = "⏳ Создаем ссылку...";
        btn.disabled = true;

        try {
            const isQuiz = (this.state.blueprint.testType === 'quiz'); 
            const score = this.state.quizScore;
            const name = prompt("Твое имя (для отображения в дуэли):", "Аноним") || "Аноним";

            const payload = { 
                h: name, 
                s: (isQuiz ? score : 0), 
                r: (isQuiz ? null : this.state.lastResultName),
                t: this.state.blueprint, 
                q: this.state.questions 
            };
            
            if(!payload.t.theme) payload.t.theme = document.getElementById('themeInput').value || "Тест";

            const jsonString = JSON.stringify(payload);
            const compressed = LZString.compressToEncodedURIComponent(jsonString);
            const longUrl = `${window.location.origin}${window.location.pathname}#d=${compressed}`;

            const response = await fetch('https://api.tinyurl.com/create', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${TINY_TOKEN}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ url: longUrl, domain: "tiny.one" })
            });

            if (!response.ok) throw new Error('API Error');
            const data = await response.json();
            const tinyUrl = data.data.tiny_url;
            
            // --- UX IMPROVEMENT: CLIPBOARD + TOAST ---
            if (navigator.clipboard && window.isSecureContext) {
                await navigator.clipboard.writeText(tinyUrl);
                this.showToast("Ссылка скопирована! Отправь другу 🚀");
            } else {
                prompt("Скопируй ссылку:", tinyUrl);
            }

        } catch (e) {
            console.error(e);
            this.showToast("Ошибка создания ссылки 😢");
        } finally {
            btn.innerHTML = originalText;
            btn.disabled = false;
        }
    },
    
    async saveTest() {
        const theme = this.state.blueprint.theme || document.getElementById('themeInput').value || "Тест";
        let shortUrl = null;

        try {
            if (typeof LZString !== 'undefined' && TINY_TOKEN) {
                const isQuiz = (this.state.blueprint.testType === 'quiz');
                const score = this.state.quizScore;

                const payload = { 
                    h: "Аноним", 
                    s: (isQuiz ? score : 0), 
                    r: (isQuiz ? null : this.state.lastResultName || null),
                    t: this.state.blueprint, 
                    q: this.state.questions 
                };

                if (!payload.t.theme) payload.t.theme = theme;

                const jsonString = JSON.stringify(payload);
                const compressed = LZString.compressToEncodedURIComponent(jsonString);
                const longUrl = `${window.location.origin}${window.location.pathname}#d=${compressed}`;

                const response = await fetch('https://api.tinyurl.com/create', {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${TINY_TOKEN}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ url: longUrl, domain: "tiny.one" })
                });

                if (response.ok) {
                    const data = await response.json();
                    shortUrl = data && data.data && data.data.tiny_url ? data.data.tiny_url : null;
                }
            }
        } catch (e) {
            console.warn("Short link generation failed (saveTest):", e);
        }

        Storage.save(this.state.blueprint, this.state.questions, theme, shortUrl);
        this.showToast("Тест сохранен в библиотеку! 💾");
        
        const btn = document.getElementById('saveTestBtn');
        if (btn) {
            btn.innerText = "✅ Сохранено";
            btn.disabled = true;
        }
    },
    
    loadSavedTest(id) {
        const test = Storage.getById(id);
        if(!test) return;
        this.state.blueprint = test.blueprint;
        this.state.questions = test.questions;
        this.state.mode = (test.blueprint.testType === 'quiz') ? 'quiz' : 'psy';
        
        this.state.step = 0;
        this.state.answers = [];
        this.state.quizScore = 0;
        this.renderQ();
        this.setView('test');
    },

    deleteTest(id) {
        if(confirm('Удалить?')) { Storage.delete(id); this.openLibrary(); }
    },

    setView(view) {
        ['setupView', 'testView', 'resultsView', 'libraryView', 'duelView'].forEach(v => {
            const el = document.getElementById(v); if(el) el.style.display = 'none';
        });
        document.getElementById(view + 'View').style.display = 'block';
    },

    setLoading(active, text) {
        const el = document.getElementById('loadingOverlay');
        if(el) { el.style.display = active ? 'flex' : 'none'; if(text) document.getElementById('loadingText').innerText = text; }
    }
};

window.onload = () => app.init();
