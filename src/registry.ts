import { CommentFactory } from './factory';

export interface ICommentRegistry {
  createFactory: <T>(options: CommentFactory.IOptions<T>) => CommentFactory<T>;
  getFactory: (id: string) => CommentFactory | undefined;

  readonly factories: Map<string, CommentFactory>;
}

/**
 * A class that manages a map of `CommentFactory`s
 */
export class CommentRegistry implements ICommentRegistry {
  createFactory<T>(options: CommentFactory.IOptions<T>): CommentFactory<T> {
    const factory = new CommentFactory<T>(options);
    this.factories.set(options.type, factory);
    return factory;
  }

  getFactory(id: string): CommentFactory | undefined {
    return this.factories.get(id);
  }

  readonly factories = new Map<string, CommentFactory>();
}