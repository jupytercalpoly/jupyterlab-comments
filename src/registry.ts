import { ACommentFactory, CellCommentFactory, CellSelectionCommentFactory } from './factory';

export interface ICommentRegistry {
  // createFactory: <T>(options: ACommentFactory.IOptions<T>) => ACommentFactory<T>;
  getFactory: (id: string) => ACommentFactory | undefined;
  addFactory: (factory: ACommentFactory | CellCommentFactory | CellSelectionCommentFactory) => void;

  readonly factories: Map<string, ACommentFactory>;
}

/**
 * A class that manages a map of `CommentFactory`s
 */
export class CommentRegistry implements ICommentRegistry {
  // createFactory<T>(options: ACommentFactory.IOptions<T>): ACommentFactory<T> {
  //   const factory = new CommentFactory<T>(options);
  //   this.factories.set(options.type, factory);
  //   return factory;
  // }

  addFactory(factory: CellCommentFactory | CellSelectionCommentFactory): void{
    if (factory instanceof CellCommentFactory){
      this.factories.set('cell', factory)
    }
    else if (factory instanceof CellSelectionCommentFactory){
      this.factories.set('cell-selection', factory)
    }
  }

  getFactory(id: string): ACommentFactory | undefined {
    return this.factories.get(id);
  }

  readonly factories = new Map<string, ACommentFactory>();
}
