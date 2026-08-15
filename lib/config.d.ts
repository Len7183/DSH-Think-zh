/**
 * dsh-think-zh 配置归一化：合并默认值 + 校验，零依赖。
 */
export interface Config {
    /** 是否向每次请求的 system prompt 注入中文语言指令。 */
    injectPrompt: boolean;
    /** 注入的指令文本；空白时回退到 DEFAULT_INJECTION_TEXT。 */
    injectionText: string;
}
/** 精简强制指令：思考必用简体中文；回复跟随提问语言（无法判断时默认简体中文）；专业术语保留原文。 */
export declare const DEFAULT_INJECTION_TEXT = "\u8BED\u8A00\u8981\u6C42\uFF08\u5F3A\u5236\uFF09\uFF1A\n1. \u601D\u8003\uFF08reasoning\uFF09\u5FC5\u987B\u4F7F\u7528\u7B80\u4F53\u4E2D\u6587\u3002\n2. \u56DE\u590D\u4F7F\u7528\u4E0E\u7528\u6237\u63D0\u95EE\u76F8\u540C\u7684\u8BED\u8A00\uFF1B\u65E0\u6CD5\u5224\u65AD\u65F6\u9ED8\u8BA4\u7B80\u4F53\u4E2D\u6587\u3002\u4EE3\u7801\u3001\u6807\u8BC6\u7B26\u3001\u6587\u4EF6\u8DEF\u5F84\u3001\u547D\u4EE4\u7B49\u4FDD\u6301\u539F\u6587\uFF0C\u4E0D\u7FFB\u8BD1\u3002";
export declare const DEFAULT_CONFIG: Config;
/** 合并默认值并校验；空白/非字符串指令回退默认，非默认字符串去除首尾空白。 */
export declare function resolveConfig(input?: Partial<Config>): Config;
