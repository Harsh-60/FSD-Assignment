import { describe, expect, it } from 'vitest';
import { taskSchema, projectSchema } from '../src/validators/schemas.js';

describe('taskSchema', () => {
  it('accepts valid task with all fields', () => {
    const result = taskSchema.parse({
      title: 'Fix login bug',
      status: 'in_progress',
      priority: 'high',
      assignee: '507f1f77bcf86cd799439011',
    });
    expect(result.title).toBe('Fix login bug');
    expect(result.status).toBe('in_progress');
    expect(result.priority).toBe('high');
  });

  it('accepts minimal task with only title', () => {
    const result = taskSchema.parse({ title: 'Minimal task' });
    expect(result.title).toBe('Minimal task');
    expect(result.status).toBeUndefined();
  });

  it('rejects empty title', () => {
    expect(() => taskSchema.parse({ title: '' })).toThrow();
  });

  it('rejects title exceeding max length', () => {
    expect(() => taskSchema.parse({ title: 'A'.repeat(181) })).toThrow();
  });

  it('rejects unsupported status values', () => {
    expect(() => taskSchema.parse({ title: 'Task', status: 'blocked' })).toThrow();
    expect(() => taskSchema.parse({ title: 'Task', status: 'in-progress' })).toThrow();
    expect(() => taskSchema.parse({ title: 'Task', status: 'DONE' })).toThrow();
  });

  it('rejects unsupported priority values', () => {
    expect(() => taskSchema.parse({ title: 'Task', priority: 'critical' })).toThrow();
  });

  it('accepts all valid status enum values', () => {
    const statuses = ['backlog', 'todo', 'in_progress', 'done'] as const;
    for (const status of statuses) {
      const result = taskSchema.parse({ title: 'Task', status });
      expect(result.status).toBe(status);
    }
  });

  it('accepts all valid priority enum values', () => {
    const priorities = ['low', 'medium', 'high', 'urgent'] as const;
    for (const priority of priorities) {
      const result = taskSchema.parse({ title: 'Task', priority });
      expect(result.priority).toBe(priority);
    }
  });

  it('partial() allows empty updates for PATCH', () => {
    const result = taskSchema.partial().parse({ status: 'done' });
    expect(result.status).toBe('done');
    expect(result.title).toBeUndefined();
  });

  it('partial() rejects invalid enum values even when partial', () => {
    expect(() => taskSchema.partial().parse({ status: 'archived' })).toThrow();
  });
});

describe('projectSchema', () => {
  it('accepts valid project key', () => {
    expect(projectSchema.parse({ name: 'Web app', key: 'WEB' }).key).toBe('WEB');
  });

  it('accepts alphanumeric project key', () => {
    const result = projectSchema.parse({ name: 'Frontend', key: 'FE001' });
    expect(result.key).toBe('FE001');
  });

  it('rejects project key starting with number', () => {
    expect(() => projectSchema.parse({ name: 'Bad Key', key: '1PROJ' })).toThrow();
  });

  it('rejects project key that is too long', () => {
    expect(() => projectSchema.parse({ name: 'Bad Key', key: 'TOOLONGKEY12' })).toThrow();
  });

  it('rejects project name that is too short', () => {
    expect(() => projectSchema.parse({ name: 'A', key: 'PROJ' })).toThrow();
  });
});
