import { Capacitor } from "@capacitor/core";
import { FirebaseAnalytics } from "@capacitor-community/firebase-analytics";
import { logEvent as logWebEvent, setUserId as setWebUserId, setUserProperties as setWebUserProperties } from "firebase/analytics";
import { getWebAnalytics } from "../lib/firebase";

export interface AnalyticsEventParams {
  [key: string]: any;
}

export class AnalyticsService {
  private static instance: AnalyticsService;
  private isNative: boolean;
  private platformName: string;
  private appVersion: string = "5.1.2";
  private isInitialized: boolean = false;

  private constructor() {
    this.isNative = Capacitor.isNativePlatform();
    this.platformName = Capacitor.getPlatform();
    this.init();
  }

  public static getInstance(): AnalyticsService {
    if (!AnalyticsService.instance) {
      AnalyticsService.instance = new AnalyticsService();
    }
    return AnalyticsService.instance;
  }

  private async init(): Promise<void> {
    if (this.isInitialized) return;
    try {
      if (this.isNative) {
        await FirebaseAnalytics.setCollectionEnabled({ enabled: true });
      }
      this.isInitialized = true;
      await this.setDefaultUserProperties();
    } catch {
      // Ignore silently - Analytics must NEVER crash the application
    }
  }

  /**
   * Log custom analytics event across platforms (Android APK / Web)
   */
  public async track(eventName: string, params: AnalyticsEventParams = {}): Promise<void> {
    try {
      const cleanParams = this.cleanParams(params);

      if (this.isNative) {
        await FirebaseAnalytics.logEvent({
          name: eventName,
          params: cleanParams,
        });
      } else {
        const webAnalytics = await getWebAnalytics();
        if (webAnalytics) {
          logWebEvent(webAnalytics, eventName, cleanParams);
        }
      }
    } catch {
      // Ignore silently
    }
  }

  /**
   * Log screen / page view across platforms
   */
  public async trackScreen(screenName: string, screenClass: string = "ReactView"): Promise<void> {
    try {
      const cleanScreen = screenName.replace(/^\//, "") || "home";
      if (this.isNative) {
        await FirebaseAnalytics.setScreenName({
          screenName: cleanScreen,
          nameOverride: screenClass,
        });
      } else {
        const webAnalytics = await getWebAnalytics();
        if (webAnalytics) {
          logWebEvent(webAnalytics, "page_view", {
            page_title: cleanScreen,
            page_location: typeof window !== "undefined" ? window.location.href : "",
            page_path: screenName,
          });
        }
      }
    } catch {
      // Ignore silently
    }
  }

  /**
   * Set user ID across analytics sessions
   */
  public async setUserId(userId: string | null): Promise<void> {
    try {
      if (this.isNative) {
        await FirebaseAnalytics.setUserId({ userId: userId || "" });
      } else {
        const webAnalytics = await getWebAnalytics();
        if (webAnalytics) {
          setWebUserId(webAnalytics, userId);
        }
      }
    } catch {
      // Ignore silently
    }
  }

  /**
   * Set single user property
   */
  public async setUserProperty(name: string, value: string | null): Promise<void> {
    try {
      const valStr = value !== null && value !== undefined ? String(value) : "";
      if (this.isNative) {
        await FirebaseAnalytics.setUserProperty({
          name,
          value: valStr,
        });
      } else {
        const webAnalytics = await getWebAnalytics();
        if (webAnalytics) {
          setWebUserProperties(webAnalytics, { [name]: valStr });
        }
      }
    } catch {
      // Ignore silently
    }
  }

  /**
   * Set multiple user properties
   */
  public async setUserProperties(properties: Record<string, string | null>): Promise<void> {
    try {
      for (const [key, value] of Object.entries(properties)) {
        await this.setUserProperty(key, value);
      }
    } catch {
      // Ignore silently
    }
  }

  /**
   * Log application error / exception safely to analytics
   */
  public async logError(error: Error | string, fatal: boolean = false, context: Record<string, any> = {}): Promise<void> {
    try {
      const errorMessage = typeof error === "string" ? error : error?.message || "Unknown error";
      const errorStack = typeof error === "object" && error?.stack ? error.stack.slice(0, 100) : "";

      await this.track("app_exception", {
        description: errorMessage.slice(0, 100),
        fatal,
        stack: errorStack,
        ...context,
      });
    } catch {
      // Ignore silently
    }
  }

  /**
   * Automatically sets baseline user properties
   */
  public async setDefaultUserProperties(): Promise<void> {
    try {
      const lang = typeof navigator !== "undefined" ? navigator.language || "en" : "en";
      await this.setUserProperties({
        platform: this.platformName,
        app_version: this.appVersion,
        theme: "dark",
        language: lang,
      });
    } catch {
      // Ignore silently
    }
  }

  private cleanParams(params: AnalyticsEventParams): AnalyticsEventParams {
    const cleaned: AnalyticsEventParams = {};
    for (const [key, val] of Object.entries(params)) {
      if (val !== undefined && val !== null) {
        if (typeof val === "object") {
          cleaned[key] = JSON.stringify(val).slice(0, 100);
        } else {
          cleaned[key] = val;
        }
      }
    }
    return cleaned;
  }
}

export const analytics = AnalyticsService.getInstance();
