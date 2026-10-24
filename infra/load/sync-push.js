/**
 * k6 load probe for PUT /v1/sync (issue #47).
 *
 * 100 pre-seeded users (see seed.mjs) each push one ~300 KB rule-valid
 * document. Two phases (separate runs, one minute apart so the 120 req/min
 * global throttle bucket never binds):
 *   PHASE=create  If-None-Match: *            -> 201, version 1
 *   PHASE=update  If-Match: "1"               -> 200, version 2
 *
 * Env: BASE_URL (default http://localhost:3000), TOKENS_FILE
 *      (default /tmp/lifespire-load-tokens.json), PHASE (create|update).
 * Gate: p(95) of tagged push requests < 300 ms.
 */
import http from 'k6/http';
import { check, sleep } from 'k6';
import { randomBytes } from 'k6/crypto';
import { Trend } from 'k6/metrics';

const BASE_URL = __ENV.BASE_URL ?? 'http://localhost:3000';
const PHASE = __ENV.PHASE ?? 'create';
const pushLatency = new Trend('push_latency_ms', true);

// open() only runs in the init (global) scope.
const TOKENS = JSON.parse(open(__ENV.TOKENS_FILE ?? '/tmp/lifespire-load-tokens.json'));
const DOCUMENT = bigDocument();
const DOCUMENT_BYTES = JSON.stringify(DOCUMENT).length;

function uuidv4() {
  const bytes = new Uint8Array(randomBytes(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function validGoal(id, titlePad) {
  return {
    id,
    title: `load goal ${id} ${'x'.repeat(titlePad)}`,
    category: 'health',
    icon: 'star',
    weeklyObjective: 3,
    active: true,
    createdAt: '2026-10-24T00:00:00.000Z',
  };
}

function bigDocument() {
  // ~300 KB: 40 valid goals with ~7.5 KB titles.
  const goals = [];
  for (let i = 0; i < 40; i += 1) goals.push(validGoal(`load-goal-${i}`, 7500));
  return {
    schemaVersion: 3,
    profile: null,
    goals,
    tasks: [],
    run: null,
    onboardingDraft: null,
    settings: { theme: 'system' },
  };
}

export function setup() {
  console.log(`push payload: ${DOCUMENT_BYTES} bytes, users: ${TOKENS.length}`);
  return { tokens: TOKENS, document: DOCUMENT };
}

export const options = {
  vus: 100,
  iterations: 100,
  thresholds: {
    'http_req_duration{op:push}': ['p(95)<300'],
  },
};

export default function push(data) {
  const me = data.tokens[__VU % data.tokens.length];
  // Fresh copy per iteration so the update phase exercises the write path
  // (identical content would take the no-op shortcut).
  const document =
    PHASE === 'update'
      ? {
          ...data.document,
          goals: data.document.goals.map((goal, index) =>
            index === 0 ? { ...goal, title: `${goal.title}#${__VU}` } : goal,
          ),
        }
      : data.document;
  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${me.token}`,
    'Idempotency-Key': uuidv4(),
  };
  if (PHASE === 'create') headers['If-None-Match'] = '*';
  else headers['If-Match'] = '"1"';

  const started = Date.now();
  const res = http.put(`${BASE_URL}/v1/sync`, JSON.stringify({ document }), {
    headers,
    tags: { op: 'push' },
  });
  pushLatency.add(Date.now() - started);

  check(res, {
    'push accepted': (r) => (PHASE === 'create' ? r.status === 201 : r.status === 200),
  });
  // Small stagger between the single iterations of a burst. The 60 s spacing
  // between phases (manual, to stay inside the 120 req/min throttle bucket)
  // is what keeps bursts apart — not this sleep.
  sleep(0.6);
}
