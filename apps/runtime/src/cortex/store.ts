import type {
    CortexBacklinkList,
    CortexCaptureInput,
    CortexCaptureResult,
    CortexJobName,
    CortexJobRun,
    CortexPage,
    CortexPageList,
    CortexRecallInput,
    CortexRecallResult,
    CortexSearchInput,
    CortexSearchResult,
    CortexStatus,
} from '@tavern/api';
import { getDb } from '../db/connection';
import type { Database } from '../db/sqlite';
import { runCortexJob } from './jobs';
import {
    getCortexPage,
    getCortexStatus,
    listCortexBacklinks,
    listCortexPages,
    recallCortex,
    searchCortex,
} from './read';
import { captureCortex } from './write';

export class CortexStore {
    readonly #db: Database;

    constructor(db: Database = getDb()) {
        this.#db = db;
    }

    listPages(limit = 100): CortexPageList {
        return listCortexPages(this.#db, limit);
    }

    getPage(slugOrId: string): CortexPage | null {
        return getCortexPage(this.#db, slugOrId);
    }

    capture(input: CortexCaptureInput): CortexCaptureResult {
        return captureCortex(this.#db, input);
    }

    search(input: CortexSearchInput): CortexSearchResult {
        return searchCortex(this.#db, input);
    }

    recall(input: CortexRecallInput): CortexRecallResult {
        return recallCortex(this.#db, input);
    }

    listBacklinks(target: string): CortexBacklinkList {
        return listCortexBacklinks(this.#db, target);
    }

    runJob(job: CortexJobName): CortexJobRun {
        return runCortexJob(this.#db, job);
    }

    status(): CortexStatus {
        return getCortexStatus(this.#db);
    }
}
