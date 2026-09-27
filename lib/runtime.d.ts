/**
 * volatile 配置引用的最小读取工具。
 *
 * 宿主 schemastery 的 `.volatile()` 字段：默认值仍是普通数据，被设置写入后
 * 变为以 `.get()` 读取的稳定引用。两种形态都要能读；任何异常回退 `undefined`，
 * 由调用方按默认值兜底。
 */
export interface VolatileLike<T> {
    get(): T;
}
/**
 * 现读一个可能是 volatile 引用、也可能是普通值的配置字段。
 * @param ref - 配置字段的当前值。
 * @returns 解引用后的值；缺失或读取失败时为 `undefined`。
 */
export declare function readVolatile<T>(ref: unknown): T | undefined;
