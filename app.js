/**
 * AI Universal Test Generator - Main Logic
 */

// --- API CLIENT ---
const api = {
    schemaCache: new WeakMap(),

    detectProvider(key) {
        return key.startsWith('AIza') ? 'gemini' : 'openrouter';
    },

    safeParseJSON(text) {
        try {
            return JSON.parse(text);
        } catch (e) {
            console.warn("Parsing failed, attempting regex extraction...");
            const match = text.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
            if (match) {
                try { return JSON.parse(match[0]); } catch (e2) {}
            }
            const mdMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
            if (mdMatch) {
                try { return JSON.parse(mdMatch[1]); } catch (e3) {}
            }
            throw new Error("Не удалось извлечь JSON из ответа.");
        }
    },

    async call(taskName, userPrompt, schema, apiKey) {
        const provider = this.detectProvider(apiKey);
        const systemPrompt = PROMPTS[provider][taskName];
        console.log(`📡 API Request: ${provider.toUpperCase()} (${taskName})`);

        if (provider === 'gemini') {
            return this.callGemini(systemPrompt, userPrompt, schema, taskName, apiKey);
        } else {
            return this.callOpenRouter(systemPrompt, userPrompt, schema, taskName, apiKey);
        }
    },

    async callOpenRouter(sys, user, schema, type, key) {
        const model = CONFIG.providers.openrouter.models[type];
        const messages = [{ role: 'system', content: sys }, { role: 'user', content: user }];

        try {
            const res = await fetch(CONFIG.providers.openrouter.endpoint, {
                method: 'POST',
                headers: CONFIG.providers.openrouter.headers(key),
                body: JSON.stringify({
                    model: model,
                    messages: messages,
                    response_format: { type: "json_object" }, 
                    temperature: 0.6
                })
            });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error?.message || 'OpenRouter Error');
            }
            const data = await res.json();
            return this.safeParseJSON(data.choices[0].message.content);
        } catch (e) {
            console.error("OpenRouter request failed:", e);
            throw e;
        }
    },

    async callGemini(sys, user, schema, type, key) {
        const model = CONFIG.providers.gemini.models[type];
        const url = `${CONFIG.providers.gemini.endpoint}${model}:generateContent?key=${key}`;

        let schemaStr;
        if (this.schemaCache.has(schema)) {
            schemaStr = this.schemaCache.get(schema);
        } else {
            schemaStr = JSON.stringify(schema);
            this.schemaCache.set(schema, schemaStr);
        }

        const prompt = `${sys}\n\nОТВЕТЬ СТРОГО В FORMAT JSON:\n${schemaStr}\n\nЗАДАЧА: ${user}`;

        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: { temperature: 0.7, response_mime_type: "application/json" }
            })
        });

        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.error?.message || 'Gemini Error');
        }
        const data = await res.json();
        return this.safeParseJSON(data.candidates[0].content.parts[0].text);
    }
};

// --- APP LOGIC ---
const app = {
    state: { step: 0, answers: [], questions: [], blueprint: null, apiKey: '' },

    async start(e) {
        if(e) e.preventDefault();
        
        // Reset State
        this.state.blueprint = null;
        this.state.questions = [];
        this.state.answers = [];
        this.state.step = 0;

        this.state.apiKey = document.getElementById('apiKeyInput').value.trim();
        const theme = document.getElementById('themeInput').value;
        const count = document.getElementById('qCountInput').value;
        const audience = document.getElementById('audienceInput').value;
        
        // 1. Считываем пожелания
        const notes = document.getElementById('notesInput').value.trim();
        const notesText = notes ? `ОСОБЫЕ ПОЖЕЛАНИЯ ЗАКАЗЧИКА: "${notes}".` : "";

        if(!this.state.apiKey) return alert("Введите API ключ!");
        sessionStorage.setItem('temp_api_key', this.state.apiKey);

        this.setLoading(true, "🧠 Архитектор проектирует тест...");
        document.getElementById('errorBox').style.display = 'none';

        try {
            // Step 1: Blueprint
            // Внедряем notesText в промпт архитектора
            const architectPrompt = `Тема: "${theme}". Аудитория: "${audience}". ${notesText} Создай структуру теста.`;

            let attempts = 0;
            let blueprint = null;
            while(attempts < 3 && !blueprint) {
                try {
                    attempts++;
                    const res = await api.call(
                        'architect',
                        architectPrompt, // <-- Используем обновленный промпт
                        SCHEMAS.blueprint,
                        this.state.apiKey
                    );
                    if (res && res.outcomes) blueprint = res;
                } catch (e) {
                    if (attempts === 3) throw e;
                }
            }
            this.state.blueprint = blueprint;

            // Step 2: Questions
            this.setLoading(true, "✍️ Автор пишет вопросы...");
            
            // Внедряем notesText в промпт генератора вопросов
            // Это самое важное место для твоего кейса с Гарри Поттером
            const genPrompt = `Тема: ${theme}. 
            Тип: ${blueprint.testType}. 
            Результаты: ${JSON.stringify(blueprint.outcomes)}. 
            Кол-во вопросов: ${count}. 
            ${notesText} (ОБЯЗАТЕЛЬНО УЧТИ ЭТО В ТЕКСТЕ ВОПРОСОВ).
            Распредели веса (Soft Weights).`;

            const content = await api.call('generator', genPrompt, SCHEMAS.questions, this.state.apiKey);
            this.state.questions = content.questions;
            
            this.renderQ();
            this.setView('test');

        } catch (err) {
            document.getElementById('errorBox').style.display = 'block';
            document.getElementById('errorBox').innerHTML = `<strong>Ошибка:</strong> ${err.message}`;
            this.setView('setup');
        }
    },

    renderQ() {
        const q = this.state.questions[this.state.step];
        const total = this.state.questions.length;
        
        document.getElementById('qNum').innerText = `${this.state.step + 1} / ${total}`;
        document.getElementById('qText').innerText = q.text;
        
        const pct = (this.state.step / total) * 100;
        document.getElementById('progressBar').style.width = pct + '%';
        
        // Очистка выделения
        document.querySelectorAll('.likert-opt').forEach(d => d.classList.remove('selected'));
        
        // Если уже был ответ на этот шаг (при возврате назад) - подсветить его
        const prevAnswer = this.state.answers[this.state.step];
        if (prevAnswer) {
            document.querySelectorAll('.likert-opt')[prevAnswer-1].classList.add('selected');
        }

        // Логика кнопки "Назад"
        const backBtn = document.getElementById('backBtn');
        if (this.state.step > 0) {
            backBtn.style.visibility = 'visible';
            backBtn.style.opacity = '1';
        } else {
            backBtn.style.visibility = 'hidden';
            backBtn.style.opacity = '0';
        }
    },

    answer(val) {
        this.state.answers[this.state.step] = val;
        document.querySelectorAll('.likert-opt')[val-1].classList.add('selected');
        
        setTimeout(() => {
            this.state.step++;
            if(this.state.step < this.state.questions.length) {
                this.renderQ();
            } else {
                this.finish();
            }
        }, 200);
    },

    // НОВАЯ ФУНКЦИЯ: НАЗАД
    prevQuestion() {
        if (this.state.step > 0) {
            this.state.step--;
            this.renderQ();
        }
    },

    finish() {
        this.setLoading(true, "📊 Считаем результаты...");
        this.setView('loading');
        setTimeout(() => {
            try { this.calc(); this.setView('results'); } 
            catch (e) { alert("Ошибка расчета: " + e.message); this.setView('setup'); }
        }, 600);
    },

    calc() {
        if (!this.state.blueprint || !this.state.blueprint.outcomes) throw new Error("Нет данных");
        
        const scores = {};
        this.state.blueprint.outcomes.forEach(o => scores[o.id] = 0);

        this.state.questions.forEach((q, idx) => {
            const ans = this.state.answers[idx];
            const userVal = (ans !== undefined ? ans : 3) - 3; 
            if (q.mapping && Array.isArray(q.mapping)) {
                q.mapping.forEach(m => {
                    if(scores[m.outcomeId] !== undefined) scores[m.outcomeId] += (m.weight * userVal);
                });
            }
        });

        const container = document.getElementById('resContent');
        let html = '';
        const isCategorical = (this.state.blueprint.testType !== 'dimensional');
        
        if(isCategorical) {
            const sorted = this.state.blueprint.outcomes.sort((a,b) => scores[b.id] - scores[a.id]);
            const win = sorted[0];
            let maxScore = Math.max(...Object.values(scores), 1); 

            html = `<div style="text-align:center; padding-bottom: 20px;">
                <div style="font-size:12px; text-transform:uppercase; letter-spacing:1px; color:var(--text-muted); margin-bottom:10px;">Твой результат</div>
                <h2 style="font-size:32px; margin:0 0 10px; color:var(--primary);">${win.name}</h2>
                <p style="font-size:18px; line-height:1.6;">${win.description}</p>
            </div>
            <div class="results-secondary-block">
                <h4 class="results-secondary-title">Другие варианты:</h4>`;
            
            sorted.slice(1).forEach(o => {
                let pct = 0;
                if (scores[o.id] > 0) pct = (scores[o.id] / maxScore) * 100;
                html += `<div class="res-item">
                    <div style="display:flex; justify-content:space-between; font-size:14px; margin-bottom:5px;">
                        <span>${o.name}</span>
                        <span style="color:var(--text-muted); font-size:12px;">${Math.round(pct)}%</span>
                    </div>
                    <div class="res-bar-bg"><div class="res-bar-fill" style="width:${pct}%"></div></div>
                </div>`;
            });
            html += `</div>`;
        } else {
            html = `<h3 style="text-align:center; margin-bottom:25px;">Твой Профиль</h3>`;
            this.state.blueprint.outcomes.forEach(o => {
                const s = scores[o.id];
                const pct = Math.min(100, Math.max(0, 50 + (s * 5)));
                let levelText = pct > 70 ? "Высокий" : pct < 30 ? "Низкий" : "Средний";
                html += `<div class="res-item">
                    <div style="display:flex; justify-content:space-between; margin-bottom:5px;">
                        <strong>${o.name}</strong>
                        <span class="badge">${levelText}</span>
                    </div>
                    <div class="res-bar-bg"><div class="res-bar-fill" style="width:${pct}%"></div></div>
                    <small style="color:var(--text-muted); display:block; margin-top:5px;">${o.description}</small>
                </div>`;
            });
        }
        container.innerHTML = html;

        const saveBtn = document.getElementById('saveTestBtn');
        if (saveBtn) {
            saveBtn.innerText = "💾 Сохранить в библиотеку";
            saveBtn.disabled = false;
        }
    },

    setView(id) {
        document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
        document.getElementById(id+'View').classList.add('active');
    },
    
    setLoading(active, msg) {
        if(active) {
            this.setView('loading');
            document.getElementById('loadTitle').innerText = msg;
        }
    },

    openLibrary() {
        if (typeof Storage === 'undefined') return alert("Модуль хранилища не загружен!");
        const html = Storage.renderLibraryHTML();
        document.getElementById('libraryContent').innerHTML = html;
        this.setView('library');
    },

    saveCurrentTest() {
        const themeInput = document.getElementById('themeInput');
        let themeName = themeInput.value || "Без темы";
        const savedName = Storage.save(this.state.blueprint, this.state.questions, themeName);
        const btn = document.getElementById('saveTestBtn');
        if (savedName) {
            if (savedName !== themeName) alert(`Тест с таким именем уже был. Сохранено как: "${savedName}"`);
            btn.innerHTML = "✅ Сохранено!";
            btn.disabled = true;
        } else alert("Ошибка при сохранении.");
    },

    loadSavedTest(id) {
        const test = Storage.getById(id);
        if (!test) return alert("Тест не найден!");
        this.state.blueprint = test.blueprint;
        this.state.questions = test.questions;
        this.state.step = 0;
        this.state.answers = [];
        this.renderQ();
        this.setView('test');
    },

    deleteTest(id) {
        if(confirm("Удалить?")) {
            Storage.delete(id);
            this.openLibrary();
        }
    }
};

// Init
document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('setupForm');
    if(form) form.addEventListener('submit', (e) => app.start(e));
});
