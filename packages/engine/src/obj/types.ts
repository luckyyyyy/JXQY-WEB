/**
 * Obj type definitions - shared across obj modules to avoid circular dependencies
 */

/**
 * Object Kind enum matching Obj.ObjKind
 */
export enum ObjKind {
  Dynamic = 0, // Animated, obstacle
  Static = 1, // Static, obstacle
  Body = 2, // Dead body
  LoopingSound = 3, // Looping sound emitter (invisible)
  RandSound = 4, // Random sound emitter (invisible)
  Door = 5, // Door
  Trap = 6, // Trap
  Drop = 7, // Dropped item
}

/**
 * Object state enum matching ObjState
 */
export enum ObjState {
  Common = 0,
  Open = 1,
  Opened = 2,
  Closed = 3,
}
