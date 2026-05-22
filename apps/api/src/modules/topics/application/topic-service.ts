import type { Topic } from "@bgreen/types";
import type { TopicRepository } from "../infrastructure/topic-repository.js";

export type CreateTopicResult = { ok: true; topic: Topic } | { ok: false; code: "slug_taken" };

export class TopicService {
  constructor(private readonly repo: TopicRepository) {}

  list(): Promise<Topic[]> {
    return this.repo.list();
  }

  get(id: string): Promise<Topic | null> {
    return this.repo.findById(id);
  }

  async create(input: {
    slug: string;
    name: string;
    createdByUserId: string | null;
  }): Promise<CreateTopicResult> {
    const existing = await this.repo.findBySlug(input.slug);
    if (existing) return { ok: false, code: "slug_taken" };
    const topic = await this.repo.insert(input);
    return { ok: true, topic };
  }

  delete(id: string): Promise<void> {
    return this.repo.delete(id);
  }
}
