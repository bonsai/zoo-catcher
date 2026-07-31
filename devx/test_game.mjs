#!/usr/bin/env node
/**
 * zoo-catcher ゲーム自動テストランナー
 *
 * public/index.html の構造と、ゲームが公開する純粋関数 (window.ZooCatcherTest) を
 * Node VM 内で検証する。結果は JSON で stdout に出力する。
 *
 * 使い方:
 *   node devx/test_game.mjs [html_path]
 */
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { execSync } from "node:child_process";

const htmlPath = process.argv[2] || "public/index.html";

const results = [];
const report = (name, ok, detail = "") => {
  results.push({ name, ok, detail });
  const mark = ok ? "PASS" : "FAIL";
  console.log(`  [${mark}] ${name}${detail ? " — " + detail : ""}`);
};

function extractScripts(html) {
  const scripts = [];
  const re = /<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    if (m[1] && m[1].trim()) scripts.push(m[1].trim());
  }
  return scripts;
}

function makeDomMock() {
  const noop = () => {};
  const el = () => ({
    style: {},
    dataset: {},
    classList: { add: noop, remove: noop, toggle: noop },
    addEventListener: noop,
    removeEventListener: noop,
    appendChild: noop,
    querySelector: () => el(),
    querySelectorAll: () => [],
    getContext: () => ({ fillRect: noop, clearRect: noop, beginPath: noop, arc: noop, fill: noop, stroke: noop, fillText: noop, measureText: () => ({ width: 0 }) }),
    setAttribute: noop,
    getAttribute: () => null,
  });
  const documentMock = {
    querySelector: () => el(),
    querySelectorAll: () => [],
    getElementById: () => el(),
    createElement: () => el(),
    addEventListener: noop,
    body: el(),
    documentElement: { clientWidth: 800, clientHeight: 600 },
  };
  const windowMock = {
    document: documentMock,
    navigator: { userAgent: "node-test" },
    innerWidth: 800,
    innerHeight: 600,
    addEventListener: noop,
    setTimeout,
    clearTimeout,
    setInterval: () => 0,
    clearInterval: noop,
    Audio: function () { this.play = noop; this.pause = noop; },
    requestAnimationFrame: (cb) => setTimeout(cb, 16),
    localStorage: { getItem: () => null, setItem: noop },
    location: { href: "" },
    console,
  };
  windowMock.window = windowMock;
  windowMock.self = windowMock;
  windowMock.globalThis = windowMock;
  documentMock.defaultView = windowMock;
  return { windowMock, documentMock };
}

// ---- 構造チェック ----
function structuralChecks(html) {
  const checks = [
    ["start-screen がある", /id\s*=\s*["']start-screen["']/],
    ["game-screen がある", /id\s*=\s*["']game-screen["']/],
    ["end-screen がある", /id\s*=\s*["']end-screen["']/],
    ["score 要素がある", /id\s*=\s*["'][^"']*score[^"']*["']/i],
    ["timer 要素がある", /id\s*=\s*["'][^"']*timer[^"']*["']/i],
    ["combo 要素がある", /id\s*=\s*["'][^"']*combo[^"']*["']/i],
  ];
  for (const [name, re] of checks) {
    report(`構造: ${name}`, re.test(html));
  }
}

// ---- 純粋関数テスト ----
function runLogicTests(ctx) {
  const T = ctx.ZooCatcherTest;
  if (!T) {
    report("logic: ZooCatcherTest が公開されている", false, "window.ZooCatcherTest が見つからない");
    return;
  }

  const num = (f) => typeof f === "function" ? f() : f;

  // スコア計算: コンボで倍率、レアで5倍
  try {
    const base = num(T.calcPoints?.({ base: 100, combo: 1, rare: false }));
    const combo = num(T.calcPoints?.({ base: 100, combo: 3, rare: false }));
    const rare = num(T.calcPoints?.({ base: 100, combo: 1, rare: true }));
    report("logic: コンボでスコアが増える", typeof combo === "number" && combo > base, `base=${base} combo=${combo}`);
    report("logic: レアは5倍", typeof rare === "number" && rare >= base * 5, `rare=${rare} base*5=${base * 5}`);
  } catch (e) {
    report("logic: calcPoints", false, String(e));
  }

  // ラウンド時間 60秒
  try {
    const d = num(T.roundDuration?.());
    report("logic: ラウンド時間=60s", d === 60, `duration=${d}`);
  } catch (e) {
    report("logic: roundDuration", false, String(e));
  }

  // 難易度: レベルが上がると速度が上がる
  try {
    const s1 = num(T.animalSpeed?.({ level: 1 }));
    const s2 = num(T.animalSpeed?.({ level: 3 }));
    report("logic: 難易度で速度が上がる", typeof s2 === "number" && s2 > s1, `lvl1=${s1} lvl3=${s2}`);
  } catch (e) {
    report("logic: animalSpeed", false, String(e));
  }

  // コンボ遷移: 成功で+1、失敗でリセット、上限あり
  try {
    const ok = num(T.nextCombo?.({ combo: 2, success: true, maxCombo: 5 }));
    const fail = num(T.nextCombo?.({ combo: 2, success: false, maxCombo: 5 }));
    const cap = num(T.nextCombo?.({ combo: 5, success: true, maxCombo: 5 }));
    report("logic: 成功でコンボ+1", ok === 3, `ok=${ok}`);
    report("logic: 失敗でリセット", fail === 0, `fail=${fail}`);
    report("logic: コンボ上限", cap === 5, `cap=${cap}`);
  } catch (e) {
    report("logic: nextCombo", false, String(e));
  }

  // 動物数: レベルで増える
  try {
    const a1 = num(T.maxAnimals?.({ level: 1, base: 4 }));
    const a2 = num(T.maxAnimals?.({ level: 4, base: 4 }));
    report("logic: レベルで動物数が増える", typeof a2 === "number" && a2 >= a1, `lvl1=${a1} lvl4=${a2}`);
  } catch (e) {
    report("logic: maxAnimals", false, String(e));
  }
}

// ---- 本体 ----
console.log(`テスト対象: ${htmlPath}`);
const html = readFileSync(htmlPath, "utf-8");
structuralChecks(html);

const scripts = extractScripts(html);
console.log(`スクリプトブロック数: ${scripts.length}`);

const { windowMock, documentMock } = makeDomMock();
const ctx = vm.createContext(windowMock);
let scriptErrors = 0;
for (const s of scripts) {
  try {
    vm.runInContext(s, ctx, { timeout: 3000 });
  } catch (e) {
    scriptErrors++;
    report(`script: 実行エラー (${String(e).slice(0, 120)})`, false);
  }
}
if (scriptErrors === 0 && scripts.length > 0) {
  report("script: 全スクリプト実行成功", true);
}
runLogicTests(ctx);

const pass = results.filter((r) => r.ok).length;
const fail = results.length - pass;
console.log(`\nRESULT: ${pass}/${results.length} passed, ${fail} failed`);

// 最低要件: 構造(6) + ロジック(実関数次第)。PASS率 60% 以上で成功とする
const minimumPassRate = 0.6;
const okOverall = results.length > 0 && pass / results.length >= minimumPassRate && scriptErrors === 0;
process.exit(okOverall ? 0 : 1);
