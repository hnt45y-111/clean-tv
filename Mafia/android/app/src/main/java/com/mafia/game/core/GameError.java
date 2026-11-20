package com.mafia.game.core;

/** خطأ برمز يُرسل للواجهة كما هو (نفس رموز خادم Node) */
public class GameError extends RuntimeException {
    public final String code;
    public GameError(String code) { super(code); this.code = code; }
}
