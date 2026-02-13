/**
 * 中文翻译资源
 */
export const zh = {
  translation: {
    brand: "Miu2D Engine",
    nav: {
      features: "功能特性",
      demo: "在线演示",
      docs: "文档",
      github: "GitHub",
      login: "登录",
      register: "注册",
      dashboard: "控制台"
    },
    auth: {
      login: {
        title: "登录 Miu2D",
        email: "邮箱",
        password: "密码",
        submit: "登录",
        loading: "登录中...",
        noAccount: "没有账号？",
        toRegister: "立即注册"
      },
      register: {
        title: "注册 Miu2D",
        name: "用户名",
        email: "邮箱",
        password: "密码",
        confirmPassword: "确认密码",
        submit: "注册",
        loading: "注册中...",
        hasAccount: "已有账号？",
        toLogin: "立即登录"
      },
      logout: "退出登录"
    },
    game: {
      title: "游戏",
      create: "创建游戏",
      myGames: "我的游戏",
      noGames: "暂无游戏"
    },
    errors: {
      common: {
        unauthorized: "未登录",
        forbidden: "无权限访问",
        requestFailed: "请求失败",
        missingGame: "缺少游戏参数",
        gameForbidden: "无权限访问该游戏"
      },
      auth: {
        invalidCredentials: "账号或密码错误",
        defaultGameNotFound: "未找到默认游戏",
        emailAlreadyRegistered: "邮箱已注册",
        passwordMismatch: "两次密码不一致"
      },
      user: {
        notFound: "用户不存在",
        emailInUse: "邮箱已被使用",
        wrongPassword: "当前密码不正确"
      },
      game: {
        notFound: "游戏不存在",
        onlyOwnerCanUpdate: "仅创建者可修改",
        onlyOwnerCanDelete: "仅创建者可删除",
        slugExists: "Slug 已存在"
      },
      file: {
        notFound: "文件或目录不存在",
        noAccess: "无权限访问该游戏的文件",
        nameConflict: "同名文件或目录已存在",
        parentNotFound: "目标目录不存在",
        parentNotFolder: "目标不是目录",
        cannotMoveToDescendant: "无法将目录移动到其子目录中",
        uploadNotComplete: "文件上传未完成",
        notAFile: "该项不是文件"
      },
      magic: {
        notFound: "武功不存在",
        fileNameConflict: "武功文件名已存在",
        invalidIniFormat: "INI 文件格式无效"
      },
      scene: {
        notFound: "场景不存在",
        itemNotFound: "场景子项不存在",
        keyConflict: "场景标识已存在"
      }
    },
    footer: {
      copyright: "© 2026 Miu2D Engine. All rights reserved.",
      tagline: "AI 驱动的 2D RPG 游戏引擎"
    }
  }
};

export type TranslationSchema = typeof zh;
