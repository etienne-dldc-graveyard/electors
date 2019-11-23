import { getInternalState } from './globale';
import { depsChanged } from './utils';
import { DependencyList, InternalContext, MemoHookData, ElectorsContext, Selector } from './types';

export const Electors = {
  createContext,
  useMemo,
};

function getCurrentContext(): InternalContext {
  const state = getInternalState().current;
  if (state === null) {
    throw new Error(`Hooks used outside of render !`);
  }
  return state;
}

function getCurrentHook(): MemoHookData | null {
  const context = getCurrentContext();
  if (context.hooks && context.hooks.length > 0) {
    return context.hooks[context.nextHooks.length] || null;
  }
  return null;
}

function setCurrentHook(hook: MemoHookData) {
  const ctx = getCurrentContext();
  ctx.nextHooks.push(hook);
}

function beforeRender(ctx: InternalContext) {
  ctx.nextHooks = [];
}

function afterRender(ctx: InternalContext) {
  if (process.env.NODE_ENV === 'development') {
    if (ctx.hooks) {
      // not first render
      if (ctx.hooks.length !== ctx.nextHooks.length) {
        throw new Error('Hooks count mismatch !');
      }
    }
  }
  ctx.hooks = ctx.nextHooks;
}

function createContext(): ElectorsContext {
  let destroyed = false;

  const context: ElectorsContext = {
    execute,
    destroy,
  };

  const internal: InternalContext = {
    context,
    hooks: null,
    nextHooks: [],
  };

  return context;

  function execute<Inputs extends Array<any>, Output>(
    selector: Selector<Inputs, Output>,
    ...inputs: Inputs
  ): Output {
    if (destroyed) {
      throw new Error('Context destroyed');
    }
    return withGlobalContext(
      internal,
      () => {
        beforeRender(internal);
        const result = selector(...inputs);
        afterRender(internal);
        return result;
      },
      null
    );
  }

  function destroy() {
    if (destroyed) {
      throw new Error('Context already destroyed');
    }
    internal.hooks = null;
  }
}

function useMemo<T>(factory: () => T, deps: DependencyList): T {
  const hook = getCurrentHook();
  if (hook === null) {
    const memoHook: MemoHookData = {
      deps,
      result: factory(),
    };
    setCurrentHook(memoHook);
    return memoHook.result;
  }
  if (depsChanged(hook.deps, deps)) {
    hook.deps = deps;
    hook.result = factory();
  }
  setCurrentHook(hook);
  return hook.result;
}

function withGlobalContext<T>(
  current: InternalContext,
  exec: () => T,
  expectedParent: InternalContext | null
): T {
  if (getInternalState().current !== expectedParent) {
    throw new Error('Invalid parent !');
  }
  getInternalState().current = current;
  const result = exec();
  getInternalState().current = expectedParent;
  return result;
}
