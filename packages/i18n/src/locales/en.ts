/**
 * 英文翻译资源
 */
import type { TranslationSchema } from "./zh.js";

export const en: TranslationSchema = {
  translation: {
    brand: "Miu2D Engine",
    nav: {
      features: "Features",
      demo: "Demo",
      docs: "Docs",
      github: "GitHub",
      login: "Sign in",
      register: "Sign up",
      dashboard: "Dashboard"
    },
    auth: {
      login: {
        title: "Sign in to Miu2D",
        email: "Email",
        password: "Password",
        submit: "Sign in",
        loading: "Signing in...",
        noAccount: "Don't have an account?",
        toRegister: "Sign up"
      },
      register: {
        title: "Sign up for Miu2D",
        name: "Username",
        email: "Email",
        password: "Password",
        confirmPassword: "Confirm Password",
        submit: "Sign up",
        loading: "Signing up...",
        hasAccount: "Already have an account?",
        toLogin: "Sign in"
      },
      logout: "Sign out"
    },
    game: {
      title: "Games",
      create: "Create Game",
      myGames: "My Games",
      noGames: "No games yet"
    },
    errors: {
      common: {
        unauthorized: "Not logged in",
        forbidden: "No permission to access",
        requestFailed: "Request failed",
        missingGame: "Missing game parameter",
        gameForbidden: "No permission to access this game"
      },
      auth: {
        invalidCredentials: "Invalid email or password",
        defaultGameNotFound: "Default game not found",
        emailAlreadyRegistered: "Email already registered",
        passwordMismatch: "Passwords do not match"
      },
      user: {
        notFound: "User not found",
        emailInUse: "Email already in use",
        wrongPassword: "Current password is incorrect"
      },
      game: {
        notFound: "Game not found",
        onlyOwnerCanUpdate: "Only the owner can update",
        onlyOwnerCanDelete: "Only the owner can delete",
        slugExists: "Slug already exists"
      },
      file: {
        notFound: "File or folder not found",
        noAccess: "No permission to access files in this game",
        nameConflict: "A file or folder with this name already exists",
        parentNotFound: "Target folder not found",
        parentNotFolder: "Target is not a folder",
        cannotMoveToDescendant: "Cannot move a folder into its own subfolder",
        uploadNotComplete: "File upload not complete",
        notAFile: "This item is not a file"
      },
      magic: {
        notFound: "Magic skill not found",
        fileNameConflict: "Magic file name already exists",
        invalidIniFormat: "Invalid INI file format"
      },
      scene: {
        notFound: "Scene not found",
        itemNotFound: "Scene item not found",
        keyConflict: "Scene key already exists"
      }
    },
    footer: {
      copyright: "© 2026 Miu2D Engine. All rights reserved.",
      tagline: "AI-powered 2D RPG Game Engine"
    }
  }
};
