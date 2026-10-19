import { describe, it, expect, vi } from 'vitest';
import { createRefreshCoordinator } from './refreshCoordinator';

/** Промис, который резолвится/реджектится вручную — чтобы держать «обмен» открытым. */
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('createRefreshCoordinator', () => {
  it('обменивает токен один раз на восемь параллельных запросов', async () => {
    // Ровно тот случай, ради которого координатор существует: страница
    // активности выпускает 8 запросов, все получают 401 одновременно. Восемь
    // обменов подряд сервер счёл бы повторным использованием одноразового
    // токена и оборвал бы все сессии.
    const gate = deferred<string>();
    const performRefresh = vi.fn(() => gate.promise);
    const coordinator = createRefreshCoordinator({ performRefresh });

    const waiters = Array.from({ length: 8 }, () => coordinator.refresh());
    gate.resolve('new-access-token');
    const results = await Promise.all(waiters);

    expect(performRefresh).toHaveBeenCalledTimes(1);
    expect(results).toEqual(Array(8).fill('new-access-token'));
  });

  it('доносит отказ до каждого ожидающего, а не только до первого', async () => {
    const gate = deferred<string>();
    const performRefresh = vi.fn(() => gate.promise);
    const coordinator = createRefreshCoordinator({ performRefresh });

    const waiters = [coordinator.refresh(), coordinator.refresh(), coordinator.refresh()];
    gate.reject(new Error('refresh token revoked'));

    const outcomes = await Promise.allSettled(waiters);
    expect(outcomes.every((o) => o.status === 'rejected')).toBe(true);
    expect(performRefresh).toHaveBeenCalledTimes(1);
  });

  it('после успешного обмена следующая волна инициирует новый обмен', async () => {
    // Иначе истечение уже следующего access-токена (через 15 минут) вернуло бы
    // давно завершившийся промис со сгоревшим токеном.
    const performRefresh = vi.fn().mockResolvedValueOnce('first').mockResolvedValueOnce('second');
    const coordinator = createRefreshCoordinator({ performRefresh });

    expect(await coordinator.refresh()).toBe('first');
    expect(await coordinator.refresh()).toBe('second');
    expect(performRefresh).toHaveBeenCalledTimes(2);
  });

  it('после неудачного обмена следующая попытка не залипает на старой ошибке', async () => {
    // Сеть моргнула — повторный вход должен работать, а не возвращать
    // закешированный отказ навсегда.
    const performRefresh = vi
      .fn()
      .mockRejectedValueOnce(new Error('network glitch'))
      .mockResolvedValueOnce('recovered');
    const coordinator = createRefreshCoordinator({ performRefresh });

    await expect(coordinator.refresh()).rejects.toThrow('network glitch');
    expect(await coordinator.refresh()).toBe('recovered');
    expect(performRefresh).toHaveBeenCalledTimes(2);
  });

  it('сбрасывает признак «идёт обмен» и при успехе, и при ошибке', async () => {
    const ok = deferred<string>();
    const okCoordinator = createRefreshCoordinator({ performRefresh: () => ok.promise });
    const pendingOk = okCoordinator.refresh();
    expect(okCoordinator.isRefreshing()).toBe(true);
    ok.resolve('done');
    await pendingOk;
    expect(okCoordinator.isRefreshing()).toBe(false);

    const bad = deferred<string>();
    const badCoordinator = createRefreshCoordinator({ performRefresh: () => bad.promise });
    const pendingBad = badCoordinator.refresh();
    expect(badCoordinator.isRefreshing()).toBe(true);
    bad.reject(new Error('nope'));
    await expect(pendingBad).rejects.toThrow('nope');
    expect(badCoordinator.isRefreshing()).toBe(false);
  });

  it('запросы, пришедшие уже после завершения обмена, получают свежий результат', async () => {
    const gate = deferred<string>();
    const performRefresh = vi.fn().mockImplementationOnce(() => gate.promise).mockResolvedValueOnce('later');
    const coordinator = createRefreshCoordinator({ performRefresh });

    const early = coordinator.refresh();
    gate.resolve('early');
    expect(await early).toBe('early');

    expect(await coordinator.refresh()).toBe('later');
  });
});
