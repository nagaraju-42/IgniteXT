import { spawn } from 'node:child_process';
import readline from 'node:readline';

/**
 * Pool of persistent `python scripts/pdf_worker.py --server` processes
 * for fast parallel image->PDF conversion, compression, and inspection.
 */
export class PyWorkerPool {
  constructor(size = 3) {
    this.size = size;
    this.workers = [];
    this.queue = [];
    this.nextReqId = 1;
    this.closed = false;
  }

  _spawnWorker(idx) {
    const child = spawn('python', ['scripts/pdf_worker.py', '--server'], {
      cwd: process.cwd(),
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    const worker = { idx, child, busy: false, pending: null };
    const rl = readline.createInterface({ input: child.stdout });

    rl.on('line', (line) => {
      const trimmed = line.trim();
      if (!trimmed.startsWith('{')) {
        return;
      }
      if (!worker.pending) return;
      let res;
      try {
        res = JSON.parse(trimmed);
      } catch {
        return;
      }
      if (res.req_id !== worker.pending.reqId) {
        return;
      }
      const { resolve } = worker.pending;
      worker.pending = null;
      worker.busy = false;
      resolve(res);
      this._drain();
    });

    child.stderr.on('data', (chunk) => {
      const msg = chunk.toString().trim();
      if (msg && !msg.includes('MuPDF error:')) {
        console.error(`[py-worker-${idx}] ${msg}`);
      }
    });

    child.on('exit', (code) => {
      if (worker.pending) {
        const { reject } = worker.pending;
        worker.pending = null;
        worker.busy = false;
        reject(new Error(`py-worker-${idx} exited unexpectedly (${code})`));
      }
      if (!this.closed) {
        this.workers[idx] = this._spawnWorker(idx);
        this._drain();
      }
    });

    return worker;
  }

  start() {
    for (let i = 0; i < this.size; i++) {
      this.workers.push(this._spawnWorker(i));
    }
  }

  _drain() {
    if (this.queue.length === 0) return;
    const idle = this.workers.find((w) => w && !w.busy && !w.child.killed);
    if (!idle) return;
    const task = this.queue.shift();
    idle.busy = true;
    idle.pending = { reqId: task.req.req_id, resolve: task.resolve, reject: task.reject };
    idle.child.stdin.write(JSON.stringify(task.req) + '\n');
  }

  exec(req) {
    return new Promise((resolve, reject) => {
      this.queue.push({
        req: { ...req, req_id: this.nextReqId++ },
        resolve,
        reject,
      });
      this._drain();
    });
  }

  async close() {
    this.closed = true;
    for (const w of this.workers) {
      if (w?.child && !w.child.killed) {
        try {
          w.child.stdin.end();
          w.child.kill();
        } catch {}
      }
    }
  }
}
