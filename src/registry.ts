import { ACommentFactory } from './factory';

export interface ICommentRegistry {
  getFactory: (id: string) => ACommentFactory | undefined;
  addFactory: (factory: ACommentFactory) => void;

  readonly factories: Map<string, ACommentFactory>;
}

/**
 * A class that manages a map of `CommentFactory`s
 */
export class CommentRegistry implements ICommentRegistry {

  addFactory(factory: ACommentFactory): void{
    this.factories.set(factory.type, factory);
  }

  getFactory(id: string): ACommentFactory | undefined {
    return this.factories.get(id);
  }

  readonly factories = new Map<string, ACommentFactory>();
}
