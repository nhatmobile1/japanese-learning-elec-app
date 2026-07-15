// Ported from japanese-grammar-app/index.html — title → JLPT level for Tofugu
// points (custom points carry their own jlptLevel field).
const JLPT_LEVELS: Record<string, string[]> = {
  "N5": [
    "Date and Time", "First-Person Pronouns", "Nouns", "Numbers and Counters",
    "Particle か", "Particle から", "Particle が (Subject)", "Particle で",
    "Particle と", "Particle に", "Particle ね", "Particle の (Noun Modifier)",
    "Particle は", "Particle へ", "Particle も", "Particle や", "Particle よ",
    "Particle を", "Personal Pronouns", "Question Words", "Second-Person Pronouns",
    "Third-Person Pronouns", "Verb Conjugation", "Verb Plain Present る Form",
    "〜じゃない・〜ではない", "〜た (Past, Plain)", "〜たい (Desire)", "〜ている",
    "〜てもいい", "〜ない (Negative, Plain)", "〜なかった (Negative, Past)", "〜ます",
    "い-Adjective かった (Past Tense Form)", "い-Adjective くない (Negative Form)",
    "い-Adjectives", "いる・ある", "ください", "くれる・あげる・もらう",
    "ここ・そこ・あそこ・どこ", "この・その・あの・どの", "これ・それ・あれ・どれ",
    "する", "だ", "だった", "て Form", "でした", "です", "な-Adjectives", "なる", "行く・来る"
  ],
  "N4": [
    "Conjunctive Particle ので", "Conjunctive Particles が・けど",
    "Honorific Prefix: 御〜 (お〜・ご〜)", "Particle まで",
    "Particle より For \"Than…\" In Comparison", "Plural and Quantity",
    "Stem Form", "Transitive and Intransitive Verbs", "〜かもしれない",
    "〜ことがある", "〜し", "〜たことがある", "〜たら", "〜たりする",
    "〜ていく・〜てくる", "〜ていた", "〜ておく", "〜てみる", "〜という",
    "〜とき (When)", "〜な For ''Don't...!''", "〜ながら (Simultaneous Actions)",
    "〜なさい (Polite, Command)", "〜にくい", "〜ば (Conditional)", "〜やすい",
    "〜よう (Volitional)", "〜れる (Potential)", "あまり〜ない",
    "い-Adjective く Form", "い-Adjective ければ", "い-Adjectiveく (Adverb Form)",
    "い-Adjectiveく (Linking)", "こそあど言葉 (Ko-So-A-Do Words)",
    "こんな・そんな・あんな・どんな", "すぎる", "だけ", "だろう", "つもり",
    "でしょう", "なら", "まだ", "もう (Already / Not Anymore)", "んだ・んです", "前・後"
  ],
  "N3": [
    "Adjective さ (Objective Nouns)", "Adjective そう", "Adjective み (Subjective Nouns)",
    "Building Sentences and Clauses", "Command Form", "Conjunctive Particle のに",
    "Particle の (Nominalizer)", "Particle よね",
    "Particle より: A Formal Version of 〜から (From)", "Plural Suffixes",
    "Verb そう", "〜させる (Causative)", "〜たがる", "〜てある", "〜てほしい",
    "〜ながら (Contrast)", "〜られる (Passive)", "〜中（じゅう）", "〜中（ちゅう）",
    "い-Adjective がる", "い-Adjectiveく (Noun)", "うち", "くらい",
    "こいつ・そいつ・あいつ・どいつ", "こう・そう・ああ・どう",
    "こちら・そちら・あちら・どちら", "こと (事)", "こなた・そなた・あなた・どなた",
    "さすが", "もう (A Little More...)", "中（なか）", "自分"
  ],
  "N2": [
    "Particle と (Conditional)", "Particle わ"
  ],
  "N1": []
};

const TITLE_TO_LEVEL = new Map<string, string>();
for (const [level, titles] of Object.entries(JLPT_LEVELS)) {
  for (const t of titles) TITLE_TO_LEVEL.set(t, level);
}

export function jlptForTitle(title: string): string | null {
  return TITLE_TO_LEVEL.get(title) ?? null;
}
