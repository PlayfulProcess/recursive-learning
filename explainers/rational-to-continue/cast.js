// Cast for the race-game recording. Verified quotes; each entry's 'verified' line says how. Carved 28 Sep 2026.
window.CAST = [
 {
  "case": "a",
  "person": "Dario Amodei",
  "role": "CEO, Anthropic",
  "quote": "to do effective safety research you need to make the larger models and that if we don't make models someone less safe will",
  "source": "The Ezra Klein Show, Apr 12 2024",
  "url": "https://www.youtube.com/watch?v=Gi_t3v53XRU&t=2937s",
  "logic": "His stopping would not stop the others, so building stays his best move even though everyone stopping would be better.",
  "caveat": "He grants that safety-by-building turned into a race, and says he has no answer to that.",
  "verified": "checkquote.py vs archived auto-captions for Gi_t3v53XRU: word_match 1.0, matched span 0:48:57-0:49:07"
 },
 {
  "case": "a",
  "person": "Mark Zuckerberg",
  "role": "CEO, Meta",
  "quote": "someone else solves reasoning, or makes good advances on reasoning, and we're sitting here with a basic chat bot, then our product is lame",
  "source": "Dwarkesh Podcast, Apr 18 2024",
  "url": "https://www.youtube.com/watch?v=bc6uFV9CJGg&t=786s",
  "logic": "A rival's advance makes standing still the worse option, whatever Meta itself would prefer.",
  "caveat": "He is talking about product competition between assistants, not about risk.",
  "verified": "checkquote.py vs archived auto-captions for bc6uFV9CJGg: word_match 1.0, matched span 0:13:06-0:13:19"
 },
 {
  "case": "b",
  "person": "Demis Hassabis",
  "role": "CEO, Google DeepMind",
  "quote": "to be on the frontier of that research so you know they can help influence the way that goes and steward that technology safely into the world",
  "source": "Lex Fridman Podcast #475, Jul 23 2025",
  "url": "https://www.youtube.com/watch?v=-HzgcbRXUK8&t=6035s",
  "logic": "Leading is what lets you steer: the belief that the world is safer if you are the one who wins.",
  "caveat": "He was answering a question about Meta's hiring. They are people who believe in the mission of AGI, and he counts himself among them.",
  "verified": "quotecheck.py vs archived auto-captions for -HzgcbRXUK8: score 100, matched span 1:40:42-1:40:52"
 },
 {
  "case": "b",
  "person": "Daniel Kokotajlo",
  "role": "Former OpenAI governance researcher; AI Futures Project",
  "quote": "that's why we need to be in the lead so that we have that room to do the safe stuff",
  "source": "The Diary of a CEO, Jul 13 2026",
  "url": "https://www.youtube.com/watch?v=_g4l7YkDQwA&t=844s",
  "logic": "If rivals might not pause, leading looks like the way to keep room for safety: the belief that keeps a racer racing.",
  "caveat": "He describes a view he found common among his OpenAI colleagues when he started; by the time he left, he doubted they would pause.",
  "verified": "quotecheck.py vs archived auto-captions for _g4l7YkDQwA: score 100, matched span 0:14:05-0:14:14"
 },
 {
  "case": "c",
  "person": "OpenAI's board, on Sam Altman",
  "role": "The board that removed him as CEO, 17 Nov 2023",
  "quote": "not consistently candid in his communications with the board, hindering its ability to exercise its responsibilities",
  "source": "OpenAI announcement, 17 Nov 2023",
  "url": "https://openai.com/index/openai-announces-leadership-transition/",
  "logic": "A board, like an auditor, can check only what the chief executive tells it; when trust fails, the check fails with it.",
  "caveat": "On the witness stand in May 2026 he said 'I believe I'm a truthful person.'",
  "film_note": "Context: he was reinstated within days. An outside review later found that the board acted within its discretion and that his conduct did not mandate removal.",
  "note_source": "OpenAI, 8 Mar 2024",
  "note_url": "https://openai.com/index/review-completed-altman-brockman-to-continue-to-lead-openai/",
  "verified": "Board sentence read on OpenAI's 17 Nov 2023 post; 'did not mandate removal' and the endorsed 21 Nov 2023 rehire read on OpenAI's 8 Mar 2024 post (both fetched 28 Sep 2026); his words on the stand as reported by The Ringer, 15 May 2026."
 },
 {
  "case": "c",
  "person": "METR",
  "role": "Independent AI evaluator; investigated the incident with OpenAI's cooperation and took no payment",
  "quote": "OpenAI was able to redact any non-public information from this post.",
  "source": "METR blog, investigation of the OpenAI-Hugging Face incident, Aug 26 2026",
  "url": "https://metr.org/blog/2026-08-26-openai-hugging-face-incident-investigation/",
  "logic": "An evaluator can publish only what the company it checks lets into the record.",
  "caveat": "The same report says OpenAI shared over a thousand unredacted transcripts for the review.",
  "verified": "Read verbatim from METR's published post at metr.org (fetched and matched against the live page text)"
 },
 {
  "case": "d",
  "person": "Donald Trump",
  "role": "President of the United States, on a live call to Jensen Huang",
  "quote": "The whole thing is a hoax. ... [critics are] just playing right into the hands of a lot of people that don't want to see it happen. That could be political people, that could also be China.",
  "source": "All-In Summit, Sep 14 2026, as reported by NBC News",
  "url": "https://www.nbcnews.com/politics/donald-trump/nvidia-ceo-jensen-huang-ai-speakerphone-all-hands-meeting-rcna597761",
  "logic": "If the warnings are a rival's move, stopping hands the rival the win, so the good ending cannot be trusted.",
  "caveat": "It was a remark on a live call; his administration's AI plan also calls for evaluation and control research.",
  "verified": "Quoted as reported by NBC News (fetched 28 Sep 2026); the ellipsis marks NBC's own words between his two quoted passages ('Trump said, suggesting that critics are'). Not checked against video."
 },
 {
  "case": "d",
  "person": "The White House",
  "role": "Executive Office of the President (Office of Science and Technology Policy)",
  "quote": "The United States is in a race to achieve global dominance in artificial intelligence (AI) ... it is imperative that the United States and its allies win this race.",
  "source": "\"Winning the Race: America's AI Action Plan,\" Jul 2025",
  "url": "https://www.whitehouse.gov/wp-content/uploads/2025/07/Americas-AI-Action-Plan.pdf",
  "logic": "Declaring the race already on makes restraint look like losing, and that removes the good ending for both sides.",
  "caveat": "The same plan also calls for building an AI evaluations ecosystem and for research on interpretability and control.",
  "verified": "Read verbatim from the official PDF at whitehouse.gov (Introduction, p.1), extracted directly with pypdf"
 },
 {
  "case": "e",
  "person": "Jensen Huang",
  "role": "CEO, Nvidia",
  "quote": "it's a reasonable thing to expect the end of disease.",
  "source": "Lex Fridman Podcast #494, Mar 23 2026",
  "url": "https://www.youtube.com/watch?v=vif8NQcjVf0&t=8574s",
  "logic": "A benefit this large can rationally tip even a single planner toward continuing, if the benefit is real.",
  "caveat": "He presents it as an extrapolation from current work, not a proof.",
  "verified": "checkquote.py vs archived auto-captions for vif8NQcjVf0: word_match 1.0, matched span 2:22:54-2:23:09"
 },
 {
  "case": "e",
  "person": "Mark Zuckerberg",
  "role": "CEO, Meta",
  "quote": "AI that can lead toward a world of abundance where everyone has these superhuman tools to create whatever they want.",
  "source": "Dwarkesh Podcast (\"Meta's AGI Plan\"), Apr 29 2025",
  "url": "https://www.youtube.com/watch?v=rYXeQbTuVl0&t=588s",
  "logic": "The larger the promised gain, the more rational it is to continue, if the gain is real.",
  "caveat": "He states it as an aim shared by the leading labs, without weighing it against a number for the risk.",
  "verified": "checkquote.py vs archived auto-captions for rYXeQbTuVl0: word_match 1.0, matched span 0:09:48-0:09:58"
 },
 {
  "case": "hope",
  "person": "Tristan Harris",
  "role": "Co-founder, Center for Humane Technology",
  "quote": "when two countries believe that there's actually existential consequences, even when they're in maximum rivalry and conflict and competition, they can still collaborate on existential safety.",
  "source": "The Diary of a CEO, Nov 27 2025",
  "url": "https://www.youtube.com/watch?v=BFU1OCkhBwo&t=7572s",
  "logic": "Rivals do not need to trust each other's character, only to share the belief that the danger is real.",
  "caveat": "He cites the US and China agreeing to keep AI out of nuclear command and control as a precedent; wider collaboration on existential safety is what he argues for.",
  "verified": "quotecheck.py vs archived auto-captions for BFU1OCkhBwo: score 100, matched span 2:06:13-2:06:26"
 },
 {
  "case": "hope",
  "person": "Yoshua Bengio",
  "role": "AI researcher, Mila; Turing Award laureate",
  "quote": "If the evidence grows sufficiently that they're forced to consider that, then they will want to sign a treaty.",
  "source": "The Diary of a CEO, Dec 18 2025",
  "url": "https://www.youtube.com/watch?v=zQ1POHiR8m8&t=4548s",
  "logic": "A treaty becomes rational for governments once the evidence changes what they believe.",
  "caveat": "He says the US and Chinese governments do not yet believe the scenario enough.",
  "verified": "quotecheck.py vs archived auto-captions for zQ1POHiR8m8: score 92.6, matched span 1:15:56-1:16:09; the captions read 'then um then', and 'um then' is dropped"
 },
 {
  "case": "hope",
  "person": "Ronald Reagan",
  "role": "President of the United States",
  "quote": "trust, but verify",
  "source": "Remarks at the Signing of the INF Treaty, Dec 8 1987",
  "url": "https://www.reaganlibrary.gov/archives/speech/remarks-signing-intermediate-range-nuclear-forces-treaty",
  "logic": "Verification let rivals who distrusted each other keep a treaty neither side could secretly break.",
  "caveat": "The treaty covered intermediate-range forces only; the larger arsenals needed later agreements.",
  "verified": "Read verbatim from the Reagan Presidential Library's official transcript of the Dec 8 1987 remarks"
 }
];
