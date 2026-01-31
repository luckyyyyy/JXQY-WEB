/**
 * TimerManager - 游戏计时器管理器
 * 基于 C# JxqyHD/Engine/Gui/TimerGui.cs
 *
 * 用于实现游戏中的时间限制功能，如限时任务
 */
import { logger } from "../core/logger";

export interface TimeScript {
  /** 触发时间（剩余秒数） */
  triggerSeconds: number;
  /** 要执行的脚本文件名 */
  scriptFileName: string;
}

export interface TimerState {
  /** 是否正在计时 */
  isRunning: boolean;
  /** 剩余秒数 */
  seconds: number;
  /** 是否隐藏计时器窗口（计时仍在进行） */
  isHidden: boolean;
  /** 累计经过的毫秒数（用于计算秒数） */
  elapsedMilliseconds: number;
  /** 时间脚本列表 */
  timeScripts: TimeScript[];
}

export class TimerManager {
  private state: TimerState = {
    isRunning: false,
    seconds: 0,
    isHidden: false,
    elapsedMilliseconds: 0,
    timeScripts: [],
  };

  /** 脚本执行回调 */
  private onRunScript: ((scriptPath: string) => void) | null = null;

  /**
   * 设置脚本执行回调
   */
  setScriptRunner(runner: (scriptPath: string) => void): void {
    this.onRunScript = runner;
  }

  /**
   * 开启时间限制
   * C#: OpenTimeLimit(int seconds)
   * @param seconds 限制时间（秒）
   */
  openTimeLimit(seconds: number): void {
    this.state.isRunning = true;
    this.state.seconds = seconds;
    this.state.isHidden = false;
    this.state.elapsedMilliseconds = 0;
    this.state.timeScripts = [];
    logger.log(`[TimerManager] OpenTimeLimit: ${seconds} seconds`);
  }

  /**
   * 关闭时间限制
   * C#: CloseTimeLimit()
   */
  closeTimeLimit(): void {
    this.state.isRunning = false;
    this.state.seconds = 0;
    this.state.isHidden = false;
    this.state.elapsedMilliseconds = 0;
    this.state.timeScripts = [];
    logger.log(`[TimerManager] CloseTimeLimit`);
  }

  /**
   * 隐藏计时器窗口（计时继续）
   * C#: HideTimerWnd()
   */
  hideTimerWnd(): void {
    this.state.isHidden = true;
    logger.log(`[TimerManager] HideTimerWnd`);
  }

  /**
   * 设置时间脚本
   * C#: SetTimeScript(int time, string scriptFileName)
   * 当计时器剩余时间等于 time 时，执行指定脚本
   *
   * 注意：C# 只支持一个 TimeScript，后设置的会覆盖前面的
   * 这里严格遵循 C# 行为，使用覆盖模式而非累加模式
   *
   * @param triggerSeconds 触发时间（剩余秒数）
   * @param scriptFileName 脚本文件名
   */
  setTimeScript(triggerSeconds: number, scriptFileName: string): void {
    if (!this.state.isRunning) {
      logger.warn(`[TimerManager] SetTimeScript ignored: timer not running`);
      return;
    }

    // C# 行为：覆盖之前设置的 TimeScript，而不是累加
    // C# Reference: ScriptExecuter._timeScriptSeconds, _timeScriptFileName, _isTimeScriptSet
    this.state.timeScripts = [
      {
        triggerSeconds,
        scriptFileName,
      },
    ];
    logger.log(`[TimerManager] SetTimeScript: at ${triggerSeconds}s run "${scriptFileName}"`);
  }

  /**
   * 更新计时器
   * @param deltaTime 时间差（秒）
   */
  update(deltaTime: number): void {
    if (!this.state.isRunning) return;

    this.state.elapsedMilliseconds += deltaTime * 1000;

    // 每过 1000 毫秒减少 1 秒
    if (this.state.elapsedMilliseconds >= 1000) {
      this.state.elapsedMilliseconds -= 1000;
      this.state.seconds--;

      // 检查时间脚本
      this.checkTimeScripts();

      // 时间到
      if (this.state.seconds <= 0) {
        this.state.seconds = 0;
        // 不自动关闭，让脚本决定
      }
    }
  }

  /**
   * 检查并触发时间脚本
   */
  private checkTimeScripts(): void {
    const currentSeconds = this.state.seconds;

    for (let i = this.state.timeScripts.length - 1; i >= 0; i--) {
      const script = this.state.timeScripts[i];
      if (script.triggerSeconds === currentSeconds) {
        logger.log(
          `[TimerManager] Triggering script at ${currentSeconds}s: ${script.scriptFileName}`
        );

        // 执行脚本
        if (this.onRunScript) {
          this.onRunScript(script.scriptFileName);
        }

        // 移除已触发的脚本
        this.state.timeScripts.splice(i, 1);
      }
    }
  }

  /**
   * 获取计时器状态（用于 UI 显示）
   */
  getState(): Readonly<TimerState> {
    return this.state;
  }

  /**
   * 是否正在计时
   */
  isTimerRunning(): boolean {
    return this.state.isRunning;
  }

  /**
   * 获取当前剩余秒数
   */
  getCurrentSeconds(): number {
    return this.state.seconds;
  }

  /**
   * 是否隐藏
   */
  isHidden(): boolean {
    return this.state.isHidden;
  }

  /**
   * 格式化时间显示
   * @returns "MM分SS秒" 格式的字符串
   */
  getFormattedTime(): string {
    const minutes = Math.floor(this.state.seconds / 60);
    const seconds = this.state.seconds % 60;
    return `${minutes.toString().padStart(2, "0")}分${seconds.toString().padStart(2, "0")}秒`;
  }

  /**
   * 重置
   */
  reset(): void {
    this.closeTimeLimit();
  }

  /**
   * 序列化状态（用于存档）
   */
  toJSON(): object {
    return {
      isRunning: this.state.isRunning,
      seconds: this.state.seconds,
      isHidden: this.state.isHidden,
      timeScripts: this.state.timeScripts,
    };
  }

  /**
   * 从存档恢复
   */
  fromJSON(data: {
    isRunning?: boolean;
    seconds?: number;
    isHidden?: boolean;
    timeScripts?: TimeScript[];
  }): void {
    if (data.isRunning !== undefined) {
      this.state.isRunning = data.isRunning;
    }
    if (data.seconds !== undefined) {
      this.state.seconds = data.seconds;
    }
    if (data.isHidden !== undefined) {
      this.state.isHidden = data.isHidden;
    }
    if (data.timeScripts !== undefined) {
      this.state.timeScripts = data.timeScripts;
    }
    this.state.elapsedMilliseconds = 0;
    logger.log(
      `[TimerManager] Restored from save: ${this.state.seconds}s, running: ${this.state.isRunning}`
    );
  }
}
