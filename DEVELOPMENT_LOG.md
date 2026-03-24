# История разработки: Лаборатория совпадений (Coincidence Laboratory)

## Сессия 1: Начальная настройка и основная логика
- **Запрос:** Создать приложение "Лаборатория совпадений", которое анализирует глобальные сигналы и генерирует спекулятивные теории.
- **Action:** 
    - Implemented a React frontend with a "Mission Control" aesthetic.
    - Created an Express backend to proxy 9 initial API sources (Hacker News, Crypto, Space, Weather, etc.).
    - Built a `narrativeEngine` using Gemini 3 Flash to synthesize theories from signals.
    - Added 4 modes: Fiction, Analyst, Paranoia, Debunk.

## Session 2: Signal Expansion (Global Intelligence)
- **Request:** Add free sources for military info, disasters, space weather, science, politics, religion, energy, and AI.
- **Action:** 
    - Added 8 new API integrations: ReliefWeb (Conflict & Disasters), NOAA (Solar K-Index), Crossref (Science), Wikipedia (History), Aladhan (Lunar), Carbon Intensity (Energy), and HN AI Search.
    - Updated UI to display these new critical signals in the sidebar.

## Session 3: Social & Demographic Layer
- **Request:** Add sources for social trends, viral news, software, demographics, and labor.
- **Action:** 
    - Integrated 5 additional sources: Reddit (Social Hype), Wikimedia (Trending Pages), GitHub (Software Stars), World Bank (Population & Unemployment).
    - Total signal sources reached 22.

## Session 4: Token Optimization & Performance
- **Request:** Optimize AI token usage and use scripts for economy.
- **Action:** 
    - Implemented `compressSignals` script to strip JSON overhead before sending to Gemini.
    - Added a server-side `theoryCache` (5-minute TTL) to prevent redundant AI calls.
    - Switched to `ThinkingLevel.LOW` for faster and cheaper generation.

## Session 5: Knowledge Graph & Memory
- **Request:** Use memory to accumulate data and connections. Add graph visualization.
- **Action:** 
    - Created a `globalKnowledgeBase` in the backend to store persistent nodes and links.
    - Integrated `react-force-graph-2d` for a real-time "Neural Knowledge Graph" visualization.
    - Theories now link back to concepts and previous observations, creating a growing web of coincidences.

## Session 6: Documentation
- **Request:** Save development history to a separate file.
- **Action:** Created `DEVELOPMENT_LOG.md` to track all project milestones and technical decisions.

## Session 7: Historical Archives & Contextual Intelligence
- **Request:** Create a catalog of modern and historical conspiracy theories and use it.
- **Action:** 
    - Created `conspiracyCatalog.ts` with 8 major historical and modern theories (MKUltra, Simulation Hypothesis, etc.).
    - Integrated this catalog into the AI's "Contextual Intelligence" layer, allowing it to draw parallels between current signals and historical precedents.
    - Added a "Historical Archives" section to the UI sidebar for operator reference.

## Session 8: Cognitive Safety & Rationality Layer
- **Request:** Implement a system to counteract confirmation bias and conspiracy thinking.
- **Action:** 
    - Updated `narrativeEngine` to generate a `criticalAnalysis` for every theory.
    - This analysis provides a sober, scientific, or logical explanation for the observed patterns, explicitly addressing cognitive biases like apophenia.
    - Added "Rational Analysis" sections to the UI (dossier modal) and "Rational Check" badges to theory cards.
    - Integrated a "Protocol: Anti-Confirmation Bias Active" indicator to emphasize the app's commitment to cognitive safety.

## Session 9: Dynamic Chronology, User Injection & Oracle Score
- **Request:** Implement suggestions 1, 3, and 4 (Thread Evolution, User Signal Injection, and Prediction Validation).
- **Action:** 
    - **Thread Evolution:** Theories now have `version` and `parentTheoryId`. The AI can evolve existing threads based on new data.
    - **User Signal Injection:** Added a "Signal Injection" terminal in the sidebar. Operators can now manually feed data (text/URLs) into the narrative engine.
    - **Oracle Score:** Implemented a prediction validation system. Theories can now be "Confirmed" as anomalies, earning an "Oracle Score". Added an "Oracle Archive" view to track these verified coincidences.
    - **UI Enhancements:** Added version badges, status indicators, and a toggle between "Active Hypotheses" and "Oracle Archive".

## Session 10: Deep Integration & Intelligence Reporting
- **Request:** Implement suggestions 6, 7, 8, and 9 (Semantic Archive Linking, Intelligence Reports Export, Interactive Knowledge Graph, and Sentiment Analysis Layer).
- **Action:** 
    - **Semantic Archive Linking:** New theories are now automatically cross-referenced with the `CONSPIRACY_CATALOG`. AI identifies historical parallels and provides direct links in the dossier.
    - **Intelligence Reports Export:** Implemented a professional export system. Users can download theories as Markdown-formatted intelligence reports, including classification, thesis, and rational analysis.
    - **Sentiment Analysis Layer:** Added a global sentiment analysis engine. The system now detects the emotional charge (e.g., "High Tension", "Paranoia") of the signal stream and displays it via a "Sentiment Meter" in the sidebar and within individual dossiers.
    - **Interactive Knowledge Graph:** Enhanced the graph visualization. Nodes are now interactive; clicking a node in the graph directly opens the corresponding theory dossier.
    - **UI Refinement:** Added sentiment bars, archive parallel sections, and export buttons to the `TheoryModal`. Cleaned up duplicate UI elements.

## Session 12: Localization & Rebranding
- **Request:** Translate the UI to Russian and rename the project to "Лаборатория совпадений".
- **Action:** 
    - Translated all UI components (App, Dashboard, KnowledgeGraph, Modals) to Russian.
    - Updated `narrativeEngine` system instructions to generate Russian content.
    - Renamed the project in `metadata.json`, `index.html`, `App.tsx`, and `exportUtils.ts`.
    - Translated `README.md` and `DEVELOPMENT_LOG.md` headers.

## Session 13: Documentation & Transparency
- **Request:** Add a list of data sources and APIs to README.md.
- **Action:** 
    - Added a detailed "Data Sources" section to `README.md` listing all 22+ API integrations.
    - Categorized sources into Tech, Finance, Space, Science, Security, Global Events, Society, and Culture.
    - Updated the development log to reflect the latest changes.
