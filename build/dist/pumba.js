(function (global, factory) {
typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports, require('fs')) :
typeof define === 'function' && define.amd ? define(['exports', 'fs'], factory) :
(global = global || self, factory(global.pumba = global.pumba || {}, global.fs));
}(this, function (exports, fs) { 'use strict';

fs = fs && fs.hasOwnProperty('default') ? fs['default'] : fs;

function _taggedTemplateLiteral(strings, raw) {
  if (!raw) {
    raw = strings.slice(0);
  }

  return Object.freeze(Object.defineProperties(strings, {
    raw: {
      value: Object.freeze(raw)
    }
  }));
}

/**
 * Lexing or parsing positional information for error reporting.
 * This object is immutable.
 */class SourceLocation{// The + prefix indicates that these fields aren't writeable
// Lexer holding the input string.
// Start offset, zero-based inclusive.
// End offset, zero-based exclusive.
constructor(lexer,start,end){this.lexer=void 0;this.start=void 0;this.end=void 0;this.lexer=lexer;this.start=start;this.end=end;}/**
   * Merges two `SourceLocation`s from location providers, given they are
   * provided in order of appearance.
   * - Returns the first one's location if only the first is provided.
   * - Returns a merged range of the first and the last if both are provided
   *   and their lexers match.
   * - Otherwise, returns null.
   */static range(first,second){if(!second){return first&&first.loc;}else if(!first||!first.loc||!second.loc||first.loc.lexer!==second.loc.lexer){return null;}else{return new SourceLocation(first.loc.lexer,first.loc.start,second.loc.end);}}}/**
 * Interface required to break circular dependency between Token, Lexer, and
 * ParseError.
 */ /**
 * The resulting token returned from `lex`.
 *
 * It consists of the token text plus some position information.
 * The position information is essentially a range in an input string,
 * but instead of referencing the bare input string, we refer to the lexer.
 * That way it is possible to attach extra metadata to the input string,
 * like for example a file name or similar.
 *
 * The position information is optional, so it is OK to construct synthetic
 * tokens if appropriate. Not providing available position information may
 * lead to degraded error reporting, though.
 */class Token{constructor(text,// the text of this token
loc){this.text=void 0;this.loc=void 0;this.text=text;this.loc=loc;}/**
   * Given a pair of tokens (this and endToken), compute a `Token` encompassing
   * the whole input range enclosed by these two.
   */range(endToken,// last token of the range, inclusive
text)// the text of the newly constructed token
{return new Token(text,SourceLocation.range(this,endToken));}}/**
 * This is the ParseError class, which is the main error thrown by KaTeX
 * functions when something has gone wrong. This is used to distinguish internal
 * errors from errors in the expression that the user provided.
 *
 * If possible, a caller should provide a Token or ParseNode with information
 * about where in the source string the problem occurred.
 */class ParseError{// Error position based on passed-in Token or ParseNode.
constructor(message,// The error message
token)// An object providing position information
{this.position=void 0;let error="KaTeX parse error: "+message;let start;const loc=token&&token.loc;if(loc&&loc.start<=loc.end){// If we have the input and a position, make the error a bit fancier
// Get the input
const input=loc.lexer.input;// Prepend some information
start=loc.start;const end=loc.end;if(start===input.length){error+=" at end of input: ";}else{error+=" at position "+(start+1)+": ";}// Underline token in question using combining underscores
const underlined=input.slice(start,end).replace(/[^]/g,"$&\u0332");// Extract some context from the input and add it to the error
let left;if(start>15){left="…"+input.slice(start-15,start);}else{left=input.slice(0,start);}let right;if(end+15<input.length){right=input.slice(end,end+15)+"…";}else{right=input.slice(end);}error+=left+underlined+right;}// Some hackery to make ParseError a prototype of Error
// See http://stackoverflow.com/a/8460753
const self=new Error(error);self.name="ParseError";// $FlowFixMe
self.__proto__=ParseError.prototype;// $FlowFixMe
self.position=start;return self;}}// $FlowFixMe More hackery
ParseError.prototype.__proto__=Error.prototype;/**
 * This file contains a list of utility functions which are useful in other
 * files.
 */ /**
 * Return whether an element is contained in a list
 */const contains=function contains(list,elem){return list.indexOf(elem)!==-1;};/**
 * Provide a default value if a setting is undefined
 * NOTE: Couldn't use `T` as the output type due to facebook/flow#5022.
 */const deflt=function deflt(setting,defaultIfUndefined){return setting===undefined?defaultIfUndefined:setting;};// hyphenate and escape adapted from Facebook's React under Apache 2 license
const uppercase=/([A-Z])/g;const hyphenate=function hyphenate(str){return str.replace(uppercase,"-$1").toLowerCase();};const ESCAPE_LOOKUP={"&":"&amp;",">":"&gt;","<":"&lt;","\"":"&quot;","'":"&#x27;"};const ESCAPE_REGEX=/[&><"']/g;/**
 * Escapes text to prevent scripting attacks.
 */function escape(text){return String(text).replace(ESCAPE_REGEX,match=>ESCAPE_LOOKUP[match]);}/**
 * Sometimes we want to pull out the innermost element of a group. In most
 * cases, this will just be the group itself, but when ordgroups and colors have
 * a single element, we want to pull that out.
 */const getBaseElem=function getBaseElem(group){if(group.type==="ordgroup"){if(group.body.length===1){return getBaseElem(group.body[0]);}else{return group;}}else if(group.type==="color"){if(group.body.length===1){return getBaseElem(group.body[0]);}else{return group;}}else if(group.type==="font"){return getBaseElem(group.body);}else{return group;}};/**
 * TeXbook algorithms often reference "character boxes", which are simply groups
 * with a single character in them. To decide if something is a character box,
 * we find its innermost group, and see if it is a single character.
 */const isCharacterBox=function isCharacterBox(group){const baseElem=getBaseElem(group);// These are all they types of groups which hold single characters
return baseElem.type==="mathord"||baseElem.type==="textord"||baseElem.type==="atom";};const assert=function assert(value){if(!value){throw new Error('Expected non-null, but got '+String(value));}return value;};var utils={contains,deflt,escape,hyphenate,getBaseElem,isCharacterBox};/* eslint no-console:0 */ /**
 * The main Settings object
 *
 * The current options stored are:
 *  - displayMode: Whether the expression should be typeset as inline math
 *                 (false, the default), meaning that the math starts in
 *                 \textstyle and is placed in an inline-block); or as display
 *                 math (true), meaning that the math starts in \displaystyle
 *                 and is placed in a block with vertical margin.
 */class Settings{constructor(options){this.displayMode=void 0;this.leqno=void 0;this.fleqn=void 0;this.throwOnError=void 0;this.errorColor=void 0;this.macros=void 0;this.colorIsTextColor=void 0;this.strict=void 0;this.maxSize=void 0;this.maxExpand=void 0;this.allowedProtocols=void 0;// allow null options
options=options||{};this.displayMode=utils.deflt(options.displayMode,false);this.leqno=utils.deflt(options.leqno,false);this.fleqn=utils.deflt(options.fleqn,false);this.throwOnError=utils.deflt(options.throwOnError,true);this.errorColor=utils.deflt(options.errorColor,"#cc0000");this.macros=options.macros||{};this.colorIsTextColor=utils.deflt(options.colorIsTextColor,false);this.strict=utils.deflt(options.strict,"warn");this.maxSize=Math.max(0,utils.deflt(options.maxSize,Infinity));this.maxExpand=Math.max(0,utils.deflt(options.maxExpand,1000));this.allowedProtocols=utils.deflt(options.allowedProtocols,["http","https","mailto","_relative"]);}/**
   * Report nonstrict (non-LaTeX-compatible) input.
   * Can safely not be called if `this.strict` is false in JavaScript.
   */reportNonstrict(errorCode,errorMsg,token){let strict=this.strict;if(typeof strict==="function"){// Allow return value of strict function to be boolean or string
// (or null/undefined, meaning no further processing).
strict=strict(errorCode,errorMsg,token);}if(!strict||strict==="ignore"){return;}else if(strict===true||strict==="error"){throw new ParseError("LaTeX-incompatible input and strict mode is set to 'error': "+`${errorMsg} [${errorCode}]`,token);}else if(strict==="warn"){typeof console!=="undefined"&&console.warn("LaTeX-incompatible input and strict mode is set to 'warn': "+`${errorMsg} [${errorCode}]`);}else{// won't happen in type-safe code
typeof console!=="undefined"&&console.warn("LaTeX-incompatible input and strict mode is set to "+`unrecognized '${strict}': ${errorMsg} [${errorCode}]`);}}/**
   * Check whether to apply strict (LaTeX-adhering) behavior for unusual
   * input (like `\\`).  Unlike `nonstrict`, will not throw an error;
   * instead, "error" translates to a return value of `true`, while "ignore"
   * translates to a return value of `false`.  May still print a warning:
   * "warn" prints a warning and returns `false`.
   * This is for the second category of `errorCode`s listed in the README.
   */useStrictBehavior(errorCode,errorMsg,token){let strict=this.strict;if(typeof strict==="function"){// Allow return value of strict function to be boolean or string
// (or null/undefined, meaning no further processing).
// But catch any exceptions thrown by function, treating them
// like "error".
try{strict=strict(errorCode,errorMsg,token);}catch(error){strict="error";}}if(!strict||strict==="ignore"){return false;}else if(strict===true||strict==="error"){return true;}else if(strict==="warn"){typeof console!=="undefined"&&console.warn("LaTeX-incompatible input and strict mode is set to 'warn': "+`${errorMsg} [${errorCode}]`);return false;}else{// won't happen in type-safe code
typeof console!=="undefined"&&console.warn("LaTeX-incompatible input and strict mode is set to "+`unrecognized '${strict}': ${errorMsg} [${errorCode}]`);return false;}}}/**
 * This file contains information and classes for the various kinds of styles
 * used in TeX. It provides a generic `Style` class, which holds information
 * about a specific style. It then provides instances of all the different kinds
 * of styles possible, and provides functions to move between them and get
 * information about them.
 */ /**
 * The main style class. Contains a unique id for the style, a size (which is
 * the same for cramped and uncramped version of a style), and a cramped flag.
 */class Style{constructor(id,size,cramped){this.id=void 0;this.size=void 0;this.cramped=void 0;this.id=id;this.size=size;this.cramped=cramped;}/**
   * Get the style of a superscript given a base in the current style.
   */sup(){return styles[sup[this.id]];}/**
   * Get the style of a subscript given a base in the current style.
   */sub(){return styles[sub[this.id]];}/**
   * Get the style of a fraction numerator given the fraction in the current
   * style.
   */fracNum(){return styles[fracNum[this.id]];}/**
   * Get the style of a fraction denominator given the fraction in the current
   * style.
   */fracDen(){return styles[fracDen[this.id]];}/**
   * Get the cramped version of a style (in particular, cramping a cramped style
   * doesn't change the style).
   */cramp(){return styles[cramp[this.id]];}/**
   * Get a text or display version of this style.
   */text(){return styles[text[this.id]];}/**
   * Return true if this style is tightly spaced (scriptstyle/scriptscriptstyle)
   */isTight(){return this.size>=2;}}// Export an interface for type checking, but don't expose the implementation.
// This way, no more styles can be generated.
// IDs of the different styles
const D=0;const Dc=1;const T=2;const Tc=3;const S=4;const Sc=5;const SS=6;const SSc=7;// Instances of the different styles
const styles=[new Style(D,0,false),new Style(Dc,0,true),new Style(T,1,false),new Style(Tc,1,true),new Style(S,2,false),new Style(Sc,2,true),new Style(SS,3,false),new Style(SSc,3,true)];// Lookup tables for switching from one style to another
const sup=[S,Sc,S,Sc,SS,SSc,SS,SSc];const sub=[Sc,Sc,Sc,Sc,SSc,SSc,SSc,SSc];const fracNum=[T,Tc,S,Sc,SS,SSc,SS,SSc];const fracDen=[Tc,Tc,Sc,Sc,SSc,SSc,SSc,SSc];const cramp=[Dc,Dc,Tc,Tc,Sc,Sc,SSc,SSc];const text=[D,Dc,T,Tc,T,Tc,T,Tc];// We only export some of the styles.
var Style$1={DISPLAY:styles[D],TEXT:styles[T],SCRIPT:styles[S],SCRIPTSCRIPT:styles[SS]};/*
 * This file defines the Unicode scripts and script families that we
 * support. To add new scripts or families, just add a new entry to the
 * scriptData array below. Adding scripts to the scriptData array allows
 * characters from that script to appear in \text{} environments.
 */ /**
 * Each script or script family has a name and an array of blocks.
 * Each block is an array of two numbers which specify the start and
 * end points (inclusive) of a block of Unicode codepoints.
 */ /**
 * Unicode block data for the families of scripts we support in \text{}.
 * Scripts only need to appear here if they do not have font metrics.
 */const scriptData=[{// Latin characters beyond the Latin-1 characters we have metrics for.
// Needed for Czech, Hungarian and Turkish text, for example.
name:'latin',blocks:[[0x0100,0x024f],// Latin Extended-A and Latin Extended-B
[0x0300,0x036f]]},{// The Cyrillic script used by Russian and related languages.
// A Cyrillic subset used to be supported as explicitly defined
// symbols in symbols.js
name:'cyrillic',blocks:[[0x0400,0x04ff]]},{// The Brahmic scripts of South and Southeast Asia
// Devanagari (0900–097F)
// Bengali (0980–09FF)
// Gurmukhi (0A00–0A7F)
// Gujarati (0A80–0AFF)
// Oriya (0B00–0B7F)
// Tamil (0B80–0BFF)
// Telugu (0C00–0C7F)
// Kannada (0C80–0CFF)
// Malayalam (0D00–0D7F)
// Sinhala (0D80–0DFF)
// Thai (0E00–0E7F)
// Lao (0E80–0EFF)
// Tibetan (0F00–0FFF)
// Myanmar (1000–109F)
name:'brahmic',blocks:[[0x0900,0x109F]]},{name:'georgian',blocks:[[0x10A0,0x10ff]]},{// Chinese and Japanese.
// The "k" in cjk is for Korean, but we've separated Korean out
name:"cjk",blocks:[[0x3000,0x30FF],// CJK symbols and punctuation, Hiragana, Katakana
[0x4E00,0x9FAF],// CJK ideograms
[0xFF00,0xFF60]]},{// Korean
name:'hangul',blocks:[[0xAC00,0xD7AF]]}];/**
 * Given a codepoint, return the name of the script or script family
 * it is from, or null if it is not part of a known block
 */function scriptFromCodepoint(codepoint){for(let i=0;i<scriptData.length;i++){const script=scriptData[i];for(let i=0;i<script.blocks.length;i++){const block=script.blocks[i];if(codepoint>=block[0]&&codepoint<=block[1]){return script.name;}}}return null;}/**
 * A flattened version of all the supported blocks in a single array.
 * This is an optimization to make supportedCodepoint() fast.
 */const allBlocks=[];scriptData.forEach(s=>s.blocks.forEach(b=>allBlocks.push(...b)));/**
 * Given a codepoint, return true if it falls within one of the
 * scripts or script families defined above and false otherwise.
 *
 * Micro benchmarks shows that this is faster than
 * /[\u3000-\u30FF\u4E00-\u9FAF\uFF00-\uFF60\uAC00-\uD7AF\u0900-\u109F]/.test()
 * in Firefox, Chrome and Node.
 */function supportedCodepoint(codepoint){for(let i=0;i<allBlocks.length;i+=2){if(codepoint>=allBlocks[i]&&codepoint<=allBlocks[i+1]){return true;}}return false;}/**
 * This file provides support to domTree.js
 * It's a storehouse of path geometry for SVG images.
 */ // In all paths below, the viewBox-to-em scale is 1000:1.
const hLinePad=80;// padding above a sqrt viniculum.
const path={// sqrtMain path geometry is from glyph U221A in the font KaTeX Main
// All surds have 80 units padding above the viniculumn.
sqrtMain:`M95,${622+hLinePad}c-2.7,0,-7.17,-2.7,-13.5,-8c-5.8,-5.3,-9.5,
-10,-9.5,-14c0,-2,0.3,-3.3,1,-4c1.3,-2.7,23.83,-20.7,67.5,-54c44.2,-33.3,65.8,
-50.3,66.5,-51c1.3,-1.3,3,-2,5,-2c4.7,0,8.7,3.3,12,10s173,378,173,378c0.7,0,
35.3,-71,104,-213c68.7,-142,137.5,-285,206.5,-429c69,-144,104.5,-217.7,106.5,
-221c5.3,-9.3,12,-14,20,-14H400000v40H845.2724s-225.272,467,-225.272,467
s-235,486,-235,486c-2.7,4.7,-9,7,-19,7c-6,0,-10,-1,-12,-3s-194,-422,-194,-422
s-65,47,-65,47z M834 ${hLinePad}H400000v40H845z`,// size1 is from glyph U221A in the font KaTeX_Size1-Regular
sqrtSize1:`M263,${601+hLinePad}c0.7,0,18,39.7,52,119c34,79.3,68.167,
158.7,102.5,238c34.3,79.3,51.8,119.3,52.5,120c340,-704.7,510.7,-1060.3,512,-1067
c4.7,-7.3,11,-11,19,-11H40000v40H1012.3s-271.3,567,-271.3,567c-38.7,80.7,-84,
175,-136,283c-52,108,-89.167,185.3,-111.5,232c-22.3,46.7,-33.8,70.3,-34.5,71
c-4.7,4.7,-12.3,7,-23,7s-12,-1,-12,-1s-109,-253,-109,-253c-72.7,-168,-109.3,
-252,-110,-252c-10.7,8,-22,16.7,-34,26c-22,17.3,-33.3,26,-34,26s-26,-26,-26,-26
s76,-59,76,-59s76,-60,76,-60z M1001 ${hLinePad}H40000v40H1012z`,// size2 is from glyph U221A in the font KaTeX_Size2-Regular
// The 80 units padding is most obvious here. Note start node at M1001 80.
sqrtSize2:`M1001,${hLinePad}H400000v40H1013.1s-83.4,268,-264.1,840c-180.7,
572,-277,876.3,-289,913c-4.7,4.7,-12.7,7,-24,7s-12,0,-12,0c-1.3,-3.3,-3.7,-11.7,
-7,-25c-35.3,-125.3,-106.7,-373.3,-214,-744c-10,12,-21,25,-33,39s-32,39,-32,39
c-6,-5.3,-15,-14,-27,-26s25,-30,25,-30c26.7,-32.7,52,-63,76,-91s52,-60,52,-60
s208,722,208,722c56,-175.3,126.3,-397.3,211,-666c84.7,-268.7,153.8,-488.2,207.5,
-658.5c53.7,-170.3,84.5,-266.8,92.5,-289.5c4,-6.7,10,-10,18,-10z
M1001 ${hLinePad}H400000v40H1013z`,// size3 is from glyph U221A in the font KaTeX_Size3-Regular
sqrtSize3:`M424,${2398+hLinePad}c-1.3,-0.7,-38.5,-172,-111.5,-514c-73,
-342,-109.8,-513.3,-110.5,-514c0,-2,-10.7,14.3,-32,49c-4.7,7.3,-9.8,15.7,-15.5,
25c-5.7,9.3,-9.8,16,-12.5,20s-5,7,-5,7c-4,-3.3,-8.3,-7.7,-13,-13s-13,-13,-13,
-13s76,-122,76,-122s77,-121,77,-121s209,968,209,968c0,-2,84.7,-361.7,254,-1079
c169.3,-717.3,254.7,-1077.7,256,-1081c4,-6.7,10,-10,18,-10H400000v40H1014.6
s-87.3,378.7,-272.6,1166c-185.3,787.3,-279.3,1182.3,-282,1185c-2,6,-10,9,-24,9
c-8,0,-12,-0.7,-12,-2z M1001 ${hLinePad}H400000v40H1014z`,// size4 is from glyph U221A in the font KaTeX_Size4-Regular
sqrtSize4:`M473,${2713+hLinePad}c339.3,-1799.3,509.3,-2700,510,-2702
c3.3,-7.3,9.3,-11,18,-11H400000v40H1017.7s-90.5,478,-276.2,1466c-185.7,988,
-279.5,1483,-281.5,1485c-2,6,-10,9,-24,9c-8,0,-12,-0.7,-12,-2c0,-1.3,-5.3,-32,
-16,-92c-50.7,-293.3,-119.7,-693.3,-207,-1200c0,-1.3,-5.3,8.7,-16,30c-10.7,
21.3,-21.3,42.7,-32,64s-16,33,-16,33s-26,-26,-26,-26s76,-153,76,-153s77,-151,
77,-151c0.7,0.7,35.7,202,105,604c67.3,400.7,102,602.7,104,606z
M1001 ${hLinePad}H400000v40H1017z`,// The doubleleftarrow geometry is from glyph U+21D0 in the font KaTeX Main
doubleleftarrow:`M262 157
l10-10c34-36 62.7-77 86-123 3.3-8 5-13.3 5-16 0-5.3-6.7-8-20-8-7.3
 0-12.2.5-14.5 1.5-2.3 1-4.8 4.5-7.5 10.5-49.3 97.3-121.7 169.3-217 216-28
 14-57.3 25-88 33-6.7 2-11 3.8-13 5.5-2 1.7-3 4.2-3 7.5s1 5.8 3 7.5
c2 1.7 6.3 3.5 13 5.5 68 17.3 128.2 47.8 180.5 91.5 52.3 43.7 93.8 96.2 124.5
 157.5 9.3 8 15.3 12.3 18 13h6c12-.7 18-4 18-10 0-2-1.7-7-5-15-23.3-46-52-87
-86-123l-10-10h399738v-40H218c328 0 0 0 0 0l-10-8c-26.7-20-65.7-43-117-69 2.7
-2 6-3.7 10-5 36.7-16 72.3-37.3 107-64l10-8h399782v-40z
m8 0v40h399730v-40zm0 194v40h399730v-40z`,// doublerightarrow is from glyph U+21D2 in font KaTeX Main
doublerightarrow:`M399738 392l
-10 10c-34 36-62.7 77-86 123-3.3 8-5 13.3-5 16 0 5.3 6.7 8 20 8 7.3 0 12.2-.5
 14.5-1.5 2.3-1 4.8-4.5 7.5-10.5 49.3-97.3 121.7-169.3 217-216 28-14 57.3-25 88
-33 6.7-2 11-3.8 13-5.5 2-1.7 3-4.2 3-7.5s-1-5.8-3-7.5c-2-1.7-6.3-3.5-13-5.5-68
-17.3-128.2-47.8-180.5-91.5-52.3-43.7-93.8-96.2-124.5-157.5-9.3-8-15.3-12.3-18
-13h-6c-12 .7-18 4-18 10 0 2 1.7 7 5 15 23.3 46 52 87 86 123l10 10H0v40h399782
c-328 0 0 0 0 0l10 8c26.7 20 65.7 43 117 69-2.7 2-6 3.7-10 5-36.7 16-72.3 37.3
-107 64l-10 8H0v40zM0 157v40h399730v-40zm0 194v40h399730v-40z`,// leftarrow is from glyph U+2190 in font KaTeX Main
leftarrow:`M400000 241H110l3-3c68.7-52.7 113.7-120
 135-202 4-14.7 6-23 6-25 0-7.3-7-11-21-11-8 0-13.2.8-15.5 2.5-2.3 1.7-4.2 5.8
-5.5 12.5-1.3 4.7-2.7 10.3-4 17-12 48.7-34.8 92-68.5 130S65.3 228.3 18 247
c-10 4-16 7.7-18 11 0 8.7 6 14.3 18 17 47.3 18.7 87.8 47 121.5 85S196 441.3 208
 490c.7 2 1.3 5 2 9s1.2 6.7 1.5 8c.3 1.3 1 3.3 2 6s2.2 4.5 3.5 5.5c1.3 1 3.3
 1.8 6 2.5s6 1 10 1c14 0 21-3.7 21-11 0-2-2-10.3-6-25-20-79.3-65-146.7-135-202
 l-3-3h399890zM100 241v40h399900v-40z`,// overbrace is from glyphs U+23A9/23A8/23A7 in font KaTeX_Size4-Regular
leftbrace:`M6 548l-6-6v-35l6-11c56-104 135.3-181.3 238-232 57.3-28.7 117
-45 179-50h399577v120H403c-43.3 7-81 15-113 26-100.7 33-179.7 91-237 174-2.7
 5-6 9-10 13-.7 1-7.3 1-20 1H6z`,leftbraceunder:`M0 6l6-6h17c12.688 0 19.313.3 20 1 4 4 7.313 8.3 10 13
 35.313 51.3 80.813 93.8 136.5 127.5 55.688 33.7 117.188 55.8 184.5 66.5.688
 0 2 .3 4 1 18.688 2.7 76 4.3 172 5h399450v120H429l-6-1c-124.688-8-235-61.7
-331-161C60.687 138.7 32.312 99.3 7 54L0 41V6z`,// overgroup is from the MnSymbol package (public domain)
leftgroup:`M400000 80
H435C64 80 168.3 229.4 21 260c-5.9 1.2-18 0-18 0-2 0-3-1-3-3v-38C76 61 257 0
 435 0h399565z`,leftgroupunder:`M400000 262
H435C64 262 168.3 112.6 21 82c-5.9-1.2-18 0-18 0-2 0-3 1-3 3v38c76 158 257 219
 435 219h399565z`,// Harpoons are from glyph U+21BD in font KaTeX Main
leftharpoon:`M0 267c.7 5.3 3 10 7 14h399993v-40H93c3.3
-3.3 10.2-9.5 20.5-18.5s17.8-15.8 22.5-20.5c50.7-52 88-110.3 112-175 4-11.3 5
-18.3 3-21-1.3-4-7.3-6-18-6-8 0-13 .7-15 2s-4.7 6.7-8 16c-42 98.7-107.3 174.7
-196 228-6.7 4.7-10.7 8-12 10-1.3 2-2 5.7-2 11zm100-26v40h399900v-40z`,leftharpoonplus:`M0 267c.7 5.3 3 10 7 14h399993v-40H93c3.3-3.3 10.2-9.5
 20.5-18.5s17.8-15.8 22.5-20.5c50.7-52 88-110.3 112-175 4-11.3 5-18.3 3-21-1.3
-4-7.3-6-18-6-8 0-13 .7-15 2s-4.7 6.7-8 16c-42 98.7-107.3 174.7-196 228-6.7 4.7
-10.7 8-12 10-1.3 2-2 5.7-2 11zm100-26v40h399900v-40zM0 435v40h400000v-40z
m0 0v40h400000v-40z`,leftharpoondown:`M7 241c-4 4-6.333 8.667-7 14 0 5.333.667 9 2 11s5.333
 5.333 12 10c90.667 54 156 130 196 228 3.333 10.667 6.333 16.333 9 17 2 .667 5
 1 9 1h5c10.667 0 16.667-2 18-6 2-2.667 1-9.667-3-21-32-87.333-82.667-157.667
-152-211l-3-3h399907v-40zM93 281 H400000 v-40L7 241z`,leftharpoondownplus:`M7 435c-4 4-6.3 8.7-7 14 0 5.3.7 9 2 11s5.3 5.3 12
 10c90.7 54 156 130 196 228 3.3 10.7 6.3 16.3 9 17 2 .7 5 1 9 1h5c10.7 0 16.7
-2 18-6 2-2.7 1-9.7-3-21-32-87.3-82.7-157.7-152-211l-3-3h399907v-40H7zm93 0
v40h399900v-40zM0 241v40h399900v-40zm0 0v40h399900v-40z`,// hook is from glyph U+21A9 in font KaTeX Main
lefthook:`M400000 281 H103s-33-11.2-61-33.5S0 197.3 0 164s14.2-61.2 42.5
-83.5C70.8 58.2 104 47 142 47 c16.7 0 25 6.7 25 20 0 12-8.7 18.7-26 20-40 3.3
-68.7 15.7-86 37-10 12-15 25.3-15 40 0 22.7 9.8 40.7 29.5 54 19.7 13.3 43.5 21
 71.5 23h399859zM103 281v-40h399897v40z`,leftlinesegment:`M40 281 V428 H0 V94 H40 V241 H400000 v40z
M40 281 V428 H0 V94 H40 V241 H400000 v40z`,leftmapsto:`M40 281 V448H0V74H40V241H400000v40z
M40 281 V448H0V74H40V241H400000v40z`,// tofrom is from glyph U+21C4 in font KaTeX AMS Regular
leftToFrom:`M0 147h400000v40H0zm0 214c68 40 115.7 95.7 143 167h22c15.3 0 23
-.3 23-1 0-1.3-5.3-13.7-16-37-18-35.3-41.3-69-70-101l-7-8h399905v-40H95l7-8
c28.7-32 52-65.7 70-101 10.7-23.3 16-35.7 16-37 0-.7-7.7-1-23-1h-22C115.7 265.3
 68 321 0 361zm0-174v-40h399900v40zm100 154v40h399900v-40z`,longequal:`M0 50 h400000 v40H0z m0 194h40000v40H0z
M0 50 h400000 v40H0z m0 194h40000v40H0z`,midbrace:`M200428 334
c-100.7-8.3-195.3-44-280-108-55.3-42-101.7-93-139-153l-9-14c-2.7 4-5.7 8.7-9 14
-53.3 86.7-123.7 153-211 199-66.7 36-137.3 56.3-212 62H0V214h199568c178.3-11.7
 311.7-78.3 403-201 6-8 9.7-12 11-12 .7-.7 6.7-1 18-1s17.3.3 18 1c1.3 0 5 4 11
 12 44.7 59.3 101.3 106.3 170 141s145.3 54.3 229 60h199572v120z`,midbraceunder:`M199572 214
c100.7 8.3 195.3 44 280 108 55.3 42 101.7 93 139 153l9 14c2.7-4 5.7-8.7 9-14
 53.3-86.7 123.7-153 211-199 66.7-36 137.3-56.3 212-62h199568v120H200432c-178.3
 11.7-311.7 78.3-403 201-6 8-9.7 12-11 12-.7.7-6.7 1-18 1s-17.3-.3-18-1c-1.3 0
-5-4-11-12-44.7-59.3-101.3-106.3-170-141s-145.3-54.3-229-60H0V214z`,oiintSize1:`M512.6 71.6c272.6 0 320.3 106.8 320.3 178.2 0 70.8-47.7 177.6
-320.3 177.6S193.1 320.6 193.1 249.8c0-71.4 46.9-178.2 319.5-178.2z
m368.1 178.2c0-86.4-60.9-215.4-368.1-215.4-306.4 0-367.3 129-367.3 215.4 0 85.8
60.9 214.8 367.3 214.8 307.2 0 368.1-129 368.1-214.8z`,oiintSize2:`M757.8 100.1c384.7 0 451.1 137.6 451.1 230 0 91.3-66.4 228.8
-451.1 228.8-386.3 0-452.7-137.5-452.7-228.8 0-92.4 66.4-230 452.7-230z
m502.4 230c0-111.2-82.4-277.2-502.4-277.2s-504 166-504 277.2
c0 110 84 276 504 276s502.4-166 502.4-276z`,oiiintSize1:`M681.4 71.6c408.9 0 480.5 106.8 480.5 178.2 0 70.8-71.6 177.6
-480.5 177.6S202.1 320.6 202.1 249.8c0-71.4 70.5-178.2 479.3-178.2z
m525.8 178.2c0-86.4-86.8-215.4-525.7-215.4-437.9 0-524.7 129-524.7 215.4 0
85.8 86.8 214.8 524.7 214.8 438.9 0 525.7-129 525.7-214.8z`,oiiintSize2:`M1021.2 53c603.6 0 707.8 165.8 707.8 277.2 0 110-104.2 275.8
-707.8 275.8-606 0-710.2-165.8-710.2-275.8C311 218.8 415.2 53 1021.2 53z
m770.4 277.1c0-131.2-126.4-327.6-770.5-327.6S248.4 198.9 248.4 330.1
c0 130 128.8 326.4 772.7 326.4s770.5-196.4 770.5-326.4z`,rightarrow:`M0 241v40h399891c-47.3 35.3-84 78-110 128
-16.7 32-27.7 63.7-33 95 0 1.3-.2 2.7-.5 4-.3 1.3-.5 2.3-.5 3 0 7.3 6.7 11 20
 11 8 0 13.2-.8 15.5-2.5 2.3-1.7 4.2-5.5 5.5-11.5 2-13.3 5.7-27 11-41 14.7-44.7
 39-84.5 73-119.5s73.7-60.2 119-75.5c6-2 9-5.7 9-11s-3-9-9-11c-45.3-15.3-85
-40.5-119-75.5s-58.3-74.8-73-119.5c-4.7-14-8.3-27.3-11-40-1.3-6.7-3.2-10.8-5.5
-12.5-2.3-1.7-7.5-2.5-15.5-2.5-14 0-21 3.7-21 11 0 2 2 10.3 6 25 20.7 83.3 67
 151.7 139 205zm0 0v40h399900v-40z`,rightbrace:`M400000 542l
-6 6h-17c-12.7 0-19.3-.3-20-1-4-4-7.3-8.3-10-13-35.3-51.3-80.8-93.8-136.5-127.5
s-117.2-55.8-184.5-66.5c-.7 0-2-.3-4-1-18.7-2.7-76-4.3-172-5H0V214h399571l6 1
c124.7 8 235 61.7 331 161 31.3 33.3 59.7 72.7 85 118l7 13v35z`,rightbraceunder:`M399994 0l6 6v35l-6 11c-56 104-135.3 181.3-238 232-57.3
 28.7-117 45-179 50H-300V214h399897c43.3-7 81-15 113-26 100.7-33 179.7-91 237
-174 2.7-5 6-9 10-13 .7-1 7.3-1 20-1h17z`,rightgroup:`M0 80h399565c371 0 266.7 149.4 414 180 5.9 1.2 18 0 18 0 2 0
 3-1 3-3v-38c-76-158-257-219-435-219H0z`,rightgroupunder:`M0 262h399565c371 0 266.7-149.4 414-180 5.9-1.2 18 0 18
 0 2 0 3 1 3 3v38c-76 158-257 219-435 219H0z`,rightharpoon:`M0 241v40h399993c4.7-4.7 7-9.3 7-14 0-9.3
-3.7-15.3-11-18-92.7-56.7-159-133.7-199-231-3.3-9.3-6-14.7-8-16-2-1.3-7-2-15-2
-10.7 0-16.7 2-18 6-2 2.7-1 9.7 3 21 15.3 42 36.7 81.8 64 119.5 27.3 37.7 58
 69.2 92 94.5zm0 0v40h399900v-40z`,rightharpoonplus:`M0 241v40h399993c4.7-4.7 7-9.3 7-14 0-9.3-3.7-15.3-11
-18-92.7-56.7-159-133.7-199-231-3.3-9.3-6-14.7-8-16-2-1.3-7-2-15-2-10.7 0-16.7
 2-18 6-2 2.7-1 9.7 3 21 15.3 42 36.7 81.8 64 119.5 27.3 37.7 58 69.2 92 94.5z
m0 0v40h399900v-40z m100 194v40h399900v-40zm0 0v40h399900v-40z`,rightharpoondown:`M399747 511c0 7.3 6.7 11 20 11 8 0 13-.8 15-2.5s4.7-6.8
 8-15.5c40-94 99.3-166.3 178-217 13.3-8 20.3-12.3 21-13 5.3-3.3 8.5-5.8 9.5
-7.5 1-1.7 1.5-5.2 1.5-10.5s-2.3-10.3-7-15H0v40h399908c-34 25.3-64.7 57-92 95
-27.3 38-48.7 77.7-64 119-3.3 8.7-5 14-5 16zM0 241v40h399900v-40z`,rightharpoondownplus:`M399747 705c0 7.3 6.7 11 20 11 8 0 13-.8
 15-2.5s4.7-6.8 8-15.5c40-94 99.3-166.3 178-217 13.3-8 20.3-12.3 21-13 5.3-3.3
 8.5-5.8 9.5-7.5 1-1.7 1.5-5.2 1.5-10.5s-2.3-10.3-7-15H0v40h399908c-34 25.3
-64.7 57-92 95-27.3 38-48.7 77.7-64 119-3.3 8.7-5 14-5 16zM0 435v40h399900v-40z
m0-194v40h400000v-40zm0 0v40h400000v-40z`,righthook:`M399859 241c-764 0 0 0 0 0 40-3.3 68.7-15.7 86-37 10-12 15-25.3
 15-40 0-22.7-9.8-40.7-29.5-54-19.7-13.3-43.5-21-71.5-23-17.3-1.3-26-8-26-20 0
-13.3 8.7-20 26-20 38 0 71 11.2 99 33.5 0 0 7 5.6 21 16.7 14 11.2 21 33.5 21
 66.8s-14 61.2-42 83.5c-28 22.3-61 33.5-99 33.5L0 241z M0 281v-40h399859v40z`,rightlinesegment:`M399960 241 V94 h40 V428 h-40 V281 H0 v-40z
M399960 241 V94 h40 V428 h-40 V281 H0 v-40z`,rightToFrom:`M400000 167c-70.7-42-118-97.7-142-167h-23c-15.3 0-23 .3-23
 1 0 1.3 5.3 13.7 16 37 18 35.3 41.3 69 70 101l7 8H0v40h399905l-7 8c-28.7 32
-52 65.7-70 101-10.7 23.3-16 35.7-16 37 0 .7 7.7 1 23 1h23c24-69.3 71.3-125 142
-167z M100 147v40h399900v-40zM0 341v40h399900v-40z`,// twoheadleftarrow is from glyph U+219E in font KaTeX AMS Regular
twoheadleftarrow:`M0 167c68 40
 115.7 95.7 143 167h22c15.3 0 23-.3 23-1 0-1.3-5.3-13.7-16-37-18-35.3-41.3-69
-70-101l-7-8h125l9 7c50.7 39.3 85 86 103 140h46c0-4.7-6.3-18.7-19-42-18-35.3
-40-67.3-66-96l-9-9h399716v-40H284l9-9c26-28.7 48-60.7 66-96 12.7-23.333 19
-37.333 19-42h-46c-18 54-52.3 100.7-103 140l-9 7H95l7-8c28.7-32 52-65.7 70-101
 10.7-23.333 16-35.7 16-37 0-.7-7.7-1-23-1h-22C115.7 71.3 68 127 0 167z`,twoheadrightarrow:`M400000 167
c-68-40-115.7-95.7-143-167h-22c-15.3 0-23 .3-23 1 0 1.3 5.3 13.7 16 37 18 35.3
 41.3 69 70 101l7 8h-125l-9-7c-50.7-39.3-85-86-103-140h-46c0 4.7 6.3 18.7 19 42
 18 35.3 40 67.3 66 96l9 9H0v40h399716l-9 9c-26 28.7-48 60.7-66 96-12.7 23.333
-19 37.333-19 42h46c18-54 52.3-100.7 103-140l9-7h125l-7 8c-28.7 32-52 65.7-70
 101-10.7 23.333-16 35.7-16 37 0 .7 7.7 1 23 1h22c27.3-71.3 75-127 143-167z`,// tilde1 is a modified version of a glyph from the MnSymbol package
tilde1:`M200 55.538c-77 0-168 73.953-177 73.953-3 0-7
-2.175-9-5.437L2 97c-1-2-2-4-2-6 0-4 2-7 5-9l20-12C116 12 171 0 207 0c86 0
 114 68 191 68 78 0 168-68 177-68 4 0 7 2 9 5l12 19c1 2.175 2 4.35 2 6.525 0
 4.35-2 7.613-5 9.788l-19 13.05c-92 63.077-116.937 75.308-183 76.128
-68.267.847-113-73.952-191-73.952z`,// ditto tilde2, tilde3, & tilde4
tilde2:`M344 55.266c-142 0-300.638 81.316-311.5 86.418
-8.01 3.762-22.5 10.91-23.5 5.562L1 120c-1-2-1-3-1-4 0-5 3-9 8-10l18.4-9C160.9
 31.9 283 0 358 0c148 0 188 122 331 122s314-97 326-97c4 0 8 2 10 7l7 21.114
c1 2.14 1 3.21 1 4.28 0 5.347-3 9.626-7 10.696l-22.3 12.622C852.6 158.372 751
 181.476 676 181.476c-149 0-189-126.21-332-126.21z`,tilde3:`M786 59C457 59 32 175.242 13 175.242c-6 0-10-3.457
-11-10.37L.15 138c-1-7 3-12 10-13l19.2-6.4C378.4 40.7 634.3 0 804.3 0c337 0
 411.8 157 746.8 157 328 0 754-112 773-112 5 0 10 3 11 9l1 14.075c1 8.066-.697
 16.595-6.697 17.492l-21.052 7.31c-367.9 98.146-609.15 122.696-778.15 122.696
 -338 0-409-156.573-744-156.573z`,tilde4:`M786 58C457 58 32 177.487 13 177.487c-6 0-10-3.345
-11-10.035L.15 143c-1-7 3-12 10-13l22-6.7C381.2 35 637.15 0 807.15 0c337 0 409
 177 744 177 328 0 754-127 773-127 5 0 10 3 11 9l1 14.794c1 7.805-3 13.38-9
 14.495l-20.7 5.574c-366.85 99.79-607.3 139.372-776.3 139.372-338 0-409
 -175.236-744-175.236z`,// vec is from glyph U+20D7 in font KaTeX Main
vec:`M377 20c0-5.333 1.833-10 5.5-14S391 0 397 0c4.667 0 8.667 1.667 12 5
3.333 2.667 6.667 9 10 19 6.667 24.667 20.333 43.667 41 57 7.333 4.667 11
10.667 11 18 0 6-1 10-3 12s-6.667 5-14 9c-28.667 14.667-53.667 35.667-75 63
-1.333 1.333-3.167 3.5-5.5 6.5s-4 4.833-5 5.5c-1 .667-2.5 1.333-4.5 2s-4.333 1
-7 1c-4.667 0-9.167-1.833-13.5-5.5S337 184 337 178c0-12.667 15.667-32.333 47-59
H213l-171-1c-8.667-6-13-12.333-13-19 0-4.667 4.333-11.333 13-20h359
c-16-25.333-24-45-24-59z`,// widehat1 is a modified version of a glyph from the MnSymbol package
widehat1:`M529 0h5l519 115c5 1 9 5 9 10 0 1-1 2-1 3l-4 22
c-1 5-5 9-11 9h-2L532 67 19 159h-2c-5 0-9-4-11-9l-5-22c-1-6 2-12 8-13z`,// ditto widehat2, widehat3, & widehat4
widehat2:`M1181 0h2l1171 176c6 0 10 5 10 11l-2 23c-1 6-5 10
-11 10h-1L1182 67 15 220h-1c-6 0-10-4-11-10l-2-23c-1-6 4-11 10-11z`,widehat3:`M1181 0h2l1171 236c6 0 10 5 10 11l-2 23c-1 6-5 10
-11 10h-1L1182 67 15 280h-1c-6 0-10-4-11-10l-2-23c-1-6 4-11 10-11z`,widehat4:`M1181 0h2l1171 296c6 0 10 5 10 11l-2 23c-1 6-5 10
-11 10h-1L1182 67 15 340h-1c-6 0-10-4-11-10l-2-23c-1-6 4-11 10-11z`,// widecheck paths are all inverted versions of widehat
widecheck1:`M529,159h5l519,-115c5,-1,9,-5,9,-10c0,-1,-1,-2,-1,-3l-4,-22c-1,
-5,-5,-9,-11,-9h-2l-512,92l-513,-92h-2c-5,0,-9,4,-11,9l-5,22c-1,6,2,12,8,13z`,widecheck2:`M1181,220h2l1171,-176c6,0,10,-5,10,-11l-2,-23c-1,-6,-5,-10,
-11,-10h-1l-1168,153l-1167,-153h-1c-6,0,-10,4,-11,10l-2,23c-1,6,4,11,10,11z`,widecheck3:`M1181,280h2l1171,-236c6,0,10,-5,10,-11l-2,-23c-1,-6,-5,-10,
-11,-10h-1l-1168,213l-1167,-213h-1c-6,0,-10,4,-11,10l-2,23c-1,6,4,11,10,11z`,widecheck4:`M1181,340h2l1171,-296c6,0,10,-5,10,-11l-2,-23c-1,-6,-5,-10,
-11,-10h-1l-1168,273l-1167,-273h-1c-6,0,-10,4,-11,10l-2,23c-1,6,4,11,10,11z`,// The next ten paths support reaction arrows from the mhchem package.
// Arrows for \ce{<-->} are offset from xAxis by 0.22ex, per mhchem in LaTeX
// baraboveleftarrow is mostly from from glyph U+2190 in font KaTeX Main
baraboveleftarrow:`M400000 620h-399890l3 -3c68.7 -52.7 113.7 -120 135 -202
c4 -14.7 6 -23 6 -25c0 -7.3 -7 -11 -21 -11c-8 0 -13.2 0.8 -15.5 2.5
c-2.3 1.7 -4.2 5.8 -5.5 12.5c-1.3 4.7 -2.7 10.3 -4 17c-12 48.7 -34.8 92 -68.5 130
s-74.2 66.3 -121.5 85c-10 4 -16 7.7 -18 11c0 8.7 6 14.3 18 17c47.3 18.7 87.8 47
121.5 85s56.5 81.3 68.5 130c0.7 2 1.3 5 2 9s1.2 6.7 1.5 8c0.3 1.3 1 3.3 2 6
s2.2 4.5 3.5 5.5c1.3 1 3.3 1.8 6 2.5s6 1 10 1c14 0 21 -3.7 21 -11
c0 -2 -2 -10.3 -6 -25c-20 -79.3 -65 -146.7 -135 -202l-3 -3h399890z
M100 620v40h399900v-40z M0 241v40h399900v-40zM0 241v40h399900v-40z`,// rightarrowabovebar is mostly from glyph U+2192, KaTeX Main
rightarrowabovebar:`M0 241v40h399891c-47.3 35.3-84 78-110 128-16.7 32
-27.7 63.7-33 95 0 1.3-.2 2.7-.5 4-.3 1.3-.5 2.3-.5 3 0 7.3 6.7 11 20 11 8 0
13.2-.8 15.5-2.5 2.3-1.7 4.2-5.5 5.5-11.5 2-13.3 5.7-27 11-41 14.7-44.7 39
-84.5 73-119.5s73.7-60.2 119-75.5c6-2 9-5.7 9-11s-3-9-9-11c-45.3-15.3-85-40.5
-119-75.5s-58.3-74.8-73-119.5c-4.7-14-8.3-27.3-11-40-1.3-6.7-3.2-10.8-5.5
-12.5-2.3-1.7-7.5-2.5-15.5-2.5-14 0-21 3.7-21 11 0 2 2 10.3 6 25 20.7 83.3 67
151.7 139 205zm96 379h399894v40H0zm0 0h399904v40H0z`,// The short left harpoon has 0.5em (i.e. 500 units) kern on the left end.
// Ref from mhchem.sty: \rlap{\raisebox{-.22ex}{$\kern0.5em
baraboveshortleftharpoon:`M507,435c-4,4,-6.3,8.7,-7,14c0,5.3,0.7,9,2,11
c1.3,2,5.3,5.3,12,10c90.7,54,156,130,196,228c3.3,10.7,6.3,16.3,9,17
c2,0.7,5,1,9,1c0,0,5,0,5,0c10.7,0,16.7,-2,18,-6c2,-2.7,1,-9.7,-3,-21
c-32,-87.3,-82.7,-157.7,-152,-211c0,0,-3,-3,-3,-3l399351,0l0,-40
c-398570,0,-399437,0,-399437,0z M593 435 v40 H399500 v-40z
M0 281 v-40 H399908 v40z M0 281 v-40 H399908 v40z`,rightharpoonaboveshortbar:`M0,241 l0,40c399126,0,399993,0,399993,0
c4.7,-4.7,7,-9.3,7,-14c0,-9.3,-3.7,-15.3,-11,-18c-92.7,-56.7,-159,-133.7,-199,
-231c-3.3,-9.3,-6,-14.7,-8,-16c-2,-1.3,-7,-2,-15,-2c-10.7,0,-16.7,2,-18,6
c-2,2.7,-1,9.7,3,21c15.3,42,36.7,81.8,64,119.5c27.3,37.7,58,69.2,92,94.5z
M0 241 v40 H399908 v-40z M0 475 v-40 H399500 v40z M0 475 v-40 H399500 v40z`,shortbaraboveleftharpoon:`M7,435c-4,4,-6.3,8.7,-7,14c0,5.3,0.7,9,2,11
c1.3,2,5.3,5.3,12,10c90.7,54,156,130,196,228c3.3,10.7,6.3,16.3,9,17c2,0.7,5,1,9,
1c0,0,5,0,5,0c10.7,0,16.7,-2,18,-6c2,-2.7,1,-9.7,-3,-21c-32,-87.3,-82.7,-157.7,
-152,-211c0,0,-3,-3,-3,-3l399907,0l0,-40c-399126,0,-399993,0,-399993,0z
M93 435 v40 H400000 v-40z M500 241 v40 H400000 v-40z M500 241 v40 H400000 v-40z`,shortrightharpoonabovebar:`M53,241l0,40c398570,0,399437,0,399437,0
c4.7,-4.7,7,-9.3,7,-14c0,-9.3,-3.7,-15.3,-11,-18c-92.7,-56.7,-159,-133.7,-199,
-231c-3.3,-9.3,-6,-14.7,-8,-16c-2,-1.3,-7,-2,-15,-2c-10.7,0,-16.7,2,-18,6
c-2,2.7,-1,9.7,3,21c15.3,42,36.7,81.8,64,119.5c27.3,37.7,58,69.2,92,94.5z
M500 241 v40 H399408 v-40z M500 435 v40 H400000 v-40z`};var svgGeometry={path};/**
 * This node represents a document fragment, which contains elements, but when
 * placed into the DOM doesn't have any representation itself. It only contains
 * children and doesn't have any DOM node properties.
 */class DocumentFragment{// HtmlDomNode
// Never used; needed for satisfying interface.
constructor(children){this.children=void 0;this.classes=void 0;this.height=void 0;this.depth=void 0;this.maxFontSize=void 0;this.style=void 0;this.children=children;this.classes=[];this.height=0;this.depth=0;this.maxFontSize=0;this.style={};}hasClass(className){return utils.contains(this.classes,className);}/** Convert the fragment into a node. */toNode(){const frag=document.createDocumentFragment();for(let i=0;i<this.children.length;i++){frag.appendChild(this.children[i].toNode());}return frag;}/** Convert the fragment into HTML markup. */toMarkup(){let markup="";// Simply concatenate the markup for the children together.
for(let i=0;i<this.children.length;i++){markup+=this.children[i].toMarkup();}return markup;}/**
   * Converts the math node into a string, similar to innerText. Applies to
   * MathDomNode's only.
   */toText(){// To avoid this, we would subclass documentFragment separately for
// MathML, but polyfills for subclassing is expensive per PR 1469.
// $FlowFixMe: Only works for ChildType = MathDomNode.
const toText=child=>child.toText();return this.children.map(toText).join("");}}/**
 * These objects store the data about the DOM nodes we create, as well as some
 * extra data. They can then be transformed into real DOM nodes with the
 * `toNode` function or HTML markup using `toMarkup`. They are useful for both
 * storing extra properties on the nodes, as well as providing a way to easily
 * work with the DOM.
 *
 * Similar functions for working with MathML nodes exist in mathMLTree.js.
 *
 * TODO: refactor `span` and `anchor` into common superclass when
 * target environments support class inheritance
 */ /**
 * Create an HTML className based on a list of classes. In addition to joining
 * with spaces, we also remove empty classes.
 */const createClass=function createClass(classes){return classes.filter(cls=>cls).join(" ");};const initNode=function initNode(classes,options,style){this.classes=classes||[];this.attributes={};this.height=0;this.depth=0;this.maxFontSize=0;this.style=style||{};if(options){if(options.style.isTight()){this.classes.push("mtight");}const color=options.getColor();if(color){this.style.color=color;}}};/**
 * Convert into an HTML node
 */const toNode=function toNode(tagName){const node=document.createElement(tagName);// Apply the class
node.className=createClass(this.classes);// Apply inline styles
for(const style in this.style){if(this.style.hasOwnProperty(style)){// $FlowFixMe Flow doesn't seem to understand span.style's type.
node.style[style]=this.style[style];}}// Apply attributes
for(const attr in this.attributes){if(this.attributes.hasOwnProperty(attr)){node.setAttribute(attr,this.attributes[attr]);}}// Append the children, also as HTML nodes
for(let i=0;i<this.children.length;i++){node.appendChild(this.children[i].toNode());}return node;};/**
 * Convert into an HTML markup string
 */const toMarkup=function toMarkup(tagName){let markup=`<${tagName}`;// Add the class
if(this.classes.length){markup+=` class="${utils.escape(createClass(this.classes))}"`;}let styles="";// Add the styles, after hyphenation
for(const style in this.style){if(this.style.hasOwnProperty(style)){styles+=`${utils.hyphenate(style)}:${this.style[style]};`;}}if(styles){markup+=` style="${utils.escape(styles)}"`;}// Add the attributes
for(const attr in this.attributes){if(this.attributes.hasOwnProperty(attr)){markup+=` ${attr}="${utils.escape(this.attributes[attr])}"`;}}markup+=">";// Add the markup of the children, also as markup
for(let i=0;i<this.children.length;i++){markup+=this.children[i].toMarkup();}markup+=`</${tagName}>`;return markup;};// Making the type below exact with all optional fields doesn't work due to
// - https://github.com/facebook/flow/issues/4582
// - https://github.com/facebook/flow/issues/5688
// However, since *all* fields are optional, $Shape<> works as suggested in 5688
// above.
// This type does not include all CSS properties. Additional properties should
// be added as needed.
/**
 * This node represents a span node, with a className, a list of children, and
 * an inline style. It also contains information about its height, depth, and
 * maxFontSize.
 *
 * Represents two types with different uses: SvgSpan to wrap an SVG and DomSpan
 * otherwise. This typesafety is important when HTML builders access a span's
 * children.
 */class Span{constructor(classes,children,options,style){this.children=void 0;this.attributes=void 0;this.classes=void 0;this.height=void 0;this.depth=void 0;this.width=void 0;this.maxFontSize=void 0;this.style=void 0;initNode.call(this,classes,options,style);this.children=children||[];}/**
   * Sets an arbitrary attribute on the span. Warning: use this wisely. Not
   * all browsers support attributes the same, and having too many custom
   * attributes is probably bad.
   */setAttribute(attribute,value){this.attributes[attribute]=value;}hasClass(className){return utils.contains(this.classes,className);}toNode(){return toNode.call(this,"span");}toMarkup(){return toMarkup.call(this,"span");}}/**
 * This node represents an anchor (<a>) element with a hyperlink.  See `span`
 * for further details.
 */class Anchor{constructor(href,classes,children,options){this.children=void 0;this.attributes=void 0;this.classes=void 0;this.height=void 0;this.depth=void 0;this.maxFontSize=void 0;this.style=void 0;initNode.call(this,classes,options);this.children=children||[];this.setAttribute('href',href);}setAttribute(attribute,value){this.attributes[attribute]=value;}hasClass(className){return utils.contains(this.classes,className);}toNode(){return toNode.call(this,"a");}toMarkup(){return toMarkup.call(this,"a");}}const iCombinations={'î':'\u0131\u0302','ï':'\u0131\u0308','í':'\u0131\u0301',// 'ī': '\u0131\u0304', // enable when we add Extended Latin
'ì':'\u0131\u0300'};/**
 * A symbol node contains information about a single symbol. It either renders
 * to a single text node, or a span with a single text node in it, depending on
 * whether it has CSS classes, styles, or needs italic correction.
 */class SymbolNode{constructor(text,height,depth,italic,skew,width,classes,style){this.text=void 0;this.height=void 0;this.depth=void 0;this.italic=void 0;this.skew=void 0;this.width=void 0;this.maxFontSize=void 0;this.classes=void 0;this.style=void 0;this.text=text;this.height=height||0;this.depth=depth||0;this.italic=italic||0;this.skew=skew||0;this.width=width||0;this.classes=classes||[];this.style=style||{};this.maxFontSize=0;// Mark text from non-Latin scripts with specific classes so that we
// can specify which fonts to use.  This allows us to render these
// characters with a serif font in situations where the browser would
// either default to a sans serif or render a placeholder character.
// We use CSS class names like cjk_fallback, hangul_fallback and
// brahmic_fallback. See ./unicodeScripts.js for the set of possible
// script names
const script=scriptFromCodepoint(this.text.charCodeAt(0));if(script){this.classes.push(script+"_fallback");}if(/[îïíì]/.test(this.text)){// add ī when we add Extended Latin
this.text=iCombinations[this.text];}}hasClass(className){return utils.contains(this.classes,className);}/**
   * Creates a text node or span from a symbol node. Note that a span is only
   * created if it is needed.
   */toNode(){const node=document.createTextNode(this.text);let span=null;if(this.italic>0){span=document.createElement("span");span.style.marginRight=this.italic+"em";}if(this.classes.length>0){span=span||document.createElement("span");span.className=createClass(this.classes);}for(const style in this.style){if(this.style.hasOwnProperty(style)){span=span||document.createElement("span");// $FlowFixMe Flow doesn't seem to understand span.style's type.
span.style[style]=this.style[style];}}if(span){span.appendChild(node);return span;}else{return node;}}/**
   * Creates markup for a symbol node.
   */toMarkup(){// TODO(alpert): More duplication than I'd like from
// span.prototype.toMarkup and symbolNode.prototype.toNode...
let needsSpan=false;let markup="<span";if(this.classes.length){needsSpan=true;markup+=" class=\"";markup+=utils.escape(createClass(this.classes));markup+="\"";}let styles="";if(this.italic>0){styles+="margin-right:"+this.italic+"em;";}for(const style in this.style){if(this.style.hasOwnProperty(style)){styles+=utils.hyphenate(style)+":"+this.style[style]+";";}}if(styles){needsSpan=true;markup+=" style=\""+utils.escape(styles)+"\"";}const escaped=utils.escape(this.text);if(needsSpan){markup+=">";markup+=escaped;markup+="</span>";return markup;}else{return escaped;}}}/**
 * SVG nodes are used to render stretchy wide elements.
 */class SvgNode{constructor(children,attributes){this.children=void 0;this.attributes=void 0;this.children=children||[];this.attributes=attributes||{};}toNode(){const svgNS="http://www.w3.org/2000/svg";const node=document.createElementNS(svgNS,"svg");// Apply attributes
for(const attr in this.attributes){if(Object.prototype.hasOwnProperty.call(this.attributes,attr)){node.setAttribute(attr,this.attributes[attr]);}}for(let i=0;i<this.children.length;i++){node.appendChild(this.children[i].toNode());}return node;}toMarkup(){let markup="<svg";// Apply attributes
for(const attr in this.attributes){if(Object.prototype.hasOwnProperty.call(this.attributes,attr)){markup+=` ${attr}='${this.attributes[attr]}'`;}}markup+=">";for(let i=0;i<this.children.length;i++){markup+=this.children[i].toMarkup();}markup+="</svg>";return markup;}}class PathNode{constructor(pathName,alternate){this.pathName=void 0;this.alternate=void 0;this.pathName=pathName;this.alternate=alternate;// Used only for tall \sqrt
}toNode(){const svgNS="http://www.w3.org/2000/svg";const node=document.createElementNS(svgNS,"path");if(this.alternate){node.setAttribute("d",this.alternate);}else{node.setAttribute("d",svgGeometry.path[this.pathName]);}return node;}toMarkup(){if(this.alternate){return `<path d='${this.alternate}'/>`;}else{return `<path d='${svgGeometry.path[this.pathName]}'/>`;}}}class LineNode{constructor(attributes){this.attributes=void 0;this.attributes=attributes||{};}toNode(){const svgNS="http://www.w3.org/2000/svg";const node=document.createElementNS(svgNS,"line");// Apply attributes
for(const attr in this.attributes){if(Object.prototype.hasOwnProperty.call(this.attributes,attr)){node.setAttribute(attr,this.attributes[attr]);}}return node;}toMarkup(){let markup="<line";for(const attr in this.attributes){if(Object.prototype.hasOwnProperty.call(this.attributes,attr)){markup+=` ${attr}='${this.attributes[attr]}'`;}}markup+="/>";return markup;}}function assertSymbolDomNode(group){if(group instanceof SymbolNode){return group;}else{throw new Error(`Expected symbolNode but got ${String(group)}.`);}}function assertSpan(group){if(group instanceof Span){return group;}else{throw new Error(`Expected span<HtmlDomNode> but got ${String(group)}.`);}}// This file is GENERATED by buildMetrics.sh. DO NOT MODIFY.
var metricMap={"AMS-Regular":{"65":[0,0.68889,0,0,0.72222],"66":[0,0.68889,0,0,0.66667],"67":[0,0.68889,0,0,0.72222],"68":[0,0.68889,0,0,0.72222],"69":[0,0.68889,0,0,0.66667],"70":[0,0.68889,0,0,0.61111],"71":[0,0.68889,0,0,0.77778],"72":[0,0.68889,0,0,0.77778],"73":[0,0.68889,0,0,0.38889],"74":[0.16667,0.68889,0,0,0.5],"75":[0,0.68889,0,0,0.77778],"76":[0,0.68889,0,0,0.66667],"77":[0,0.68889,0,0,0.94445],"78":[0,0.68889,0,0,0.72222],"79":[0.16667,0.68889,0,0,0.77778],"80":[0,0.68889,0,0,0.61111],"81":[0.16667,0.68889,0,0,0.77778],"82":[0,0.68889,0,0,0.72222],"83":[0,0.68889,0,0,0.55556],"84":[0,0.68889,0,0,0.66667],"85":[0,0.68889,0,0,0.72222],"86":[0,0.68889,0,0,0.72222],"87":[0,0.68889,0,0,1.0],"88":[0,0.68889,0,0,0.72222],"89":[0,0.68889,0,0,0.72222],"90":[0,0.68889,0,0,0.66667],"107":[0,0.68889,0,0,0.55556],"165":[0,0.675,0.025,0,0.75],"174":[0.15559,0.69224,0,0,0.94666],"240":[0,0.68889,0,0,0.55556],"295":[0,0.68889,0,0,0.54028],"710":[0,0.825,0,0,2.33334],"732":[0,0.9,0,0,2.33334],"770":[0,0.825,0,0,2.33334],"771":[0,0.9,0,0,2.33334],"989":[0.08167,0.58167,0,0,0.77778],"1008":[0,0.43056,0.04028,0,0.66667],"8245":[0,0.54986,0,0,0.275],"8463":[0,0.68889,0,0,0.54028],"8487":[0,0.68889,0,0,0.72222],"8498":[0,0.68889,0,0,0.55556],"8502":[0,0.68889,0,0,0.66667],"8503":[0,0.68889,0,0,0.44445],"8504":[0,0.68889,0,0,0.66667],"8513":[0,0.68889,0,0,0.63889],"8592":[-0.03598,0.46402,0,0,0.5],"8594":[-0.03598,0.46402,0,0,0.5],"8602":[-0.13313,0.36687,0,0,1.0],"8603":[-0.13313,0.36687,0,0,1.0],"8606":[0.01354,0.52239,0,0,1.0],"8608":[0.01354,0.52239,0,0,1.0],"8610":[0.01354,0.52239,0,0,1.11111],"8611":[0.01354,0.52239,0,0,1.11111],"8619":[0,0.54986,0,0,1.0],"8620":[0,0.54986,0,0,1.0],"8621":[-0.13313,0.37788,0,0,1.38889],"8622":[-0.13313,0.36687,0,0,1.0],"8624":[0,0.69224,0,0,0.5],"8625":[0,0.69224,0,0,0.5],"8630":[0,0.43056,0,0,1.0],"8631":[0,0.43056,0,0,1.0],"8634":[0.08198,0.58198,0,0,0.77778],"8635":[0.08198,0.58198,0,0,0.77778],"8638":[0.19444,0.69224,0,0,0.41667],"8639":[0.19444,0.69224,0,0,0.41667],"8642":[0.19444,0.69224,0,0,0.41667],"8643":[0.19444,0.69224,0,0,0.41667],"8644":[0.1808,0.675,0,0,1.0],"8646":[0.1808,0.675,0,0,1.0],"8647":[0.1808,0.675,0,0,1.0],"8648":[0.19444,0.69224,0,0,0.83334],"8649":[0.1808,0.675,0,0,1.0],"8650":[0.19444,0.69224,0,0,0.83334],"8651":[0.01354,0.52239,0,0,1.0],"8652":[0.01354,0.52239,0,0,1.0],"8653":[-0.13313,0.36687,0,0,1.0],"8654":[-0.13313,0.36687,0,0,1.0],"8655":[-0.13313,0.36687,0,0,1.0],"8666":[0.13667,0.63667,0,0,1.0],"8667":[0.13667,0.63667,0,0,1.0],"8669":[-0.13313,0.37788,0,0,1.0],"8672":[-0.064,0.437,0,0,1.334],"8674":[-0.064,0.437,0,0,1.334],"8705":[0,0.825,0,0,0.5],"8708":[0,0.68889,0,0,0.55556],"8709":[0.08167,0.58167,0,0,0.77778],"8717":[0,0.43056,0,0,0.42917],"8722":[-0.03598,0.46402,0,0,0.5],"8724":[0.08198,0.69224,0,0,0.77778],"8726":[0.08167,0.58167,0,0,0.77778],"8733":[0,0.69224,0,0,0.77778],"8736":[0,0.69224,0,0,0.72222],"8737":[0,0.69224,0,0,0.72222],"8738":[0.03517,0.52239,0,0,0.72222],"8739":[0.08167,0.58167,0,0,0.22222],"8740":[0.25142,0.74111,0,0,0.27778],"8741":[0.08167,0.58167,0,0,0.38889],"8742":[0.25142,0.74111,0,0,0.5],"8756":[0,0.69224,0,0,0.66667],"8757":[0,0.69224,0,0,0.66667],"8764":[-0.13313,0.36687,0,0,0.77778],"8765":[-0.13313,0.37788,0,0,0.77778],"8769":[-0.13313,0.36687,0,0,0.77778],"8770":[-0.03625,0.46375,0,0,0.77778],"8774":[0.30274,0.79383,0,0,0.77778],"8776":[-0.01688,0.48312,0,0,0.77778],"8778":[0.08167,0.58167,0,0,0.77778],"8782":[0.06062,0.54986,0,0,0.77778],"8783":[0.06062,0.54986,0,0,0.77778],"8785":[0.08198,0.58198,0,0,0.77778],"8786":[0.08198,0.58198,0,0,0.77778],"8787":[0.08198,0.58198,0,0,0.77778],"8790":[0,0.69224,0,0,0.77778],"8791":[0.22958,0.72958,0,0,0.77778],"8796":[0.08198,0.91667,0,0,0.77778],"8806":[0.25583,0.75583,0,0,0.77778],"8807":[0.25583,0.75583,0,0,0.77778],"8808":[0.25142,0.75726,0,0,0.77778],"8809":[0.25142,0.75726,0,0,0.77778],"8812":[0.25583,0.75583,0,0,0.5],"8814":[0.20576,0.70576,0,0,0.77778],"8815":[0.20576,0.70576,0,0,0.77778],"8816":[0.30274,0.79383,0,0,0.77778],"8817":[0.30274,0.79383,0,0,0.77778],"8818":[0.22958,0.72958,0,0,0.77778],"8819":[0.22958,0.72958,0,0,0.77778],"8822":[0.1808,0.675,0,0,0.77778],"8823":[0.1808,0.675,0,0,0.77778],"8828":[0.13667,0.63667,0,0,0.77778],"8829":[0.13667,0.63667,0,0,0.77778],"8830":[0.22958,0.72958,0,0,0.77778],"8831":[0.22958,0.72958,0,0,0.77778],"8832":[0.20576,0.70576,0,0,0.77778],"8833":[0.20576,0.70576,0,0,0.77778],"8840":[0.30274,0.79383,0,0,0.77778],"8841":[0.30274,0.79383,0,0,0.77778],"8842":[0.13597,0.63597,0,0,0.77778],"8843":[0.13597,0.63597,0,0,0.77778],"8847":[0.03517,0.54986,0,0,0.77778],"8848":[0.03517,0.54986,0,0,0.77778],"8858":[0.08198,0.58198,0,0,0.77778],"8859":[0.08198,0.58198,0,0,0.77778],"8861":[0.08198,0.58198,0,0,0.77778],"8862":[0,0.675,0,0,0.77778],"8863":[0,0.675,0,0,0.77778],"8864":[0,0.675,0,0,0.77778],"8865":[0,0.675,0,0,0.77778],"8872":[0,0.69224,0,0,0.61111],"8873":[0,0.69224,0,0,0.72222],"8874":[0,0.69224,0,0,0.88889],"8876":[0,0.68889,0,0,0.61111],"8877":[0,0.68889,0,0,0.61111],"8878":[0,0.68889,0,0,0.72222],"8879":[0,0.68889,0,0,0.72222],"8882":[0.03517,0.54986,0,0,0.77778],"8883":[0.03517,0.54986,0,0,0.77778],"8884":[0.13667,0.63667,0,0,0.77778],"8885":[0.13667,0.63667,0,0,0.77778],"8888":[0,0.54986,0,0,1.11111],"8890":[0.19444,0.43056,0,0,0.55556],"8891":[0.19444,0.69224,0,0,0.61111],"8892":[0.19444,0.69224,0,0,0.61111],"8901":[0,0.54986,0,0,0.27778],"8903":[0.08167,0.58167,0,0,0.77778],"8905":[0.08167,0.58167,0,0,0.77778],"8906":[0.08167,0.58167,0,0,0.77778],"8907":[0,0.69224,0,0,0.77778],"8908":[0,0.69224,0,0,0.77778],"8909":[-0.03598,0.46402,0,0,0.77778],"8910":[0,0.54986,0,0,0.76042],"8911":[0,0.54986,0,0,0.76042],"8912":[0.03517,0.54986,0,0,0.77778],"8913":[0.03517,0.54986,0,0,0.77778],"8914":[0,0.54986,0,0,0.66667],"8915":[0,0.54986,0,0,0.66667],"8916":[0,0.69224,0,0,0.66667],"8918":[0.0391,0.5391,0,0,0.77778],"8919":[0.0391,0.5391,0,0,0.77778],"8920":[0.03517,0.54986,0,0,1.33334],"8921":[0.03517,0.54986,0,0,1.33334],"8922":[0.38569,0.88569,0,0,0.77778],"8923":[0.38569,0.88569,0,0,0.77778],"8926":[0.13667,0.63667,0,0,0.77778],"8927":[0.13667,0.63667,0,0,0.77778],"8928":[0.30274,0.79383,0,0,0.77778],"8929":[0.30274,0.79383,0,0,0.77778],"8934":[0.23222,0.74111,0,0,0.77778],"8935":[0.23222,0.74111,0,0,0.77778],"8936":[0.23222,0.74111,0,0,0.77778],"8937":[0.23222,0.74111,0,0,0.77778],"8938":[0.20576,0.70576,0,0,0.77778],"8939":[0.20576,0.70576,0,0,0.77778],"8940":[0.30274,0.79383,0,0,0.77778],"8941":[0.30274,0.79383,0,0,0.77778],"8994":[0.19444,0.69224,0,0,0.77778],"8995":[0.19444,0.69224,0,0,0.77778],"9416":[0.15559,0.69224,0,0,0.90222],"9484":[0,0.69224,0,0,0.5],"9488":[0,0.69224,0,0,0.5],"9492":[0,0.37788,0,0,0.5],"9496":[0,0.37788,0,0,0.5],"9585":[0.19444,0.68889,0,0,0.88889],"9586":[0.19444,0.74111,0,0,0.88889],"9632":[0,0.675,0,0,0.77778],"9633":[0,0.675,0,0,0.77778],"9650":[0,0.54986,0,0,0.72222],"9651":[0,0.54986,0,0,0.72222],"9654":[0.03517,0.54986,0,0,0.77778],"9660":[0,0.54986,0,0,0.72222],"9661":[0,0.54986,0,0,0.72222],"9664":[0.03517,0.54986,0,0,0.77778],"9674":[0.11111,0.69224,0,0,0.66667],"9733":[0.19444,0.69224,0,0,0.94445],"10003":[0,0.69224,0,0,0.83334],"10016":[0,0.69224,0,0,0.83334],"10731":[0.11111,0.69224,0,0,0.66667],"10846":[0.19444,0.75583,0,0,0.61111],"10877":[0.13667,0.63667,0,0,0.77778],"10878":[0.13667,0.63667,0,0,0.77778],"10885":[0.25583,0.75583,0,0,0.77778],"10886":[0.25583,0.75583,0,0,0.77778],"10887":[0.13597,0.63597,0,0,0.77778],"10888":[0.13597,0.63597,0,0,0.77778],"10889":[0.26167,0.75726,0,0,0.77778],"10890":[0.26167,0.75726,0,0,0.77778],"10891":[0.48256,0.98256,0,0,0.77778],"10892":[0.48256,0.98256,0,0,0.77778],"10901":[0.13667,0.63667,0,0,0.77778],"10902":[0.13667,0.63667,0,0,0.77778],"10933":[0.25142,0.75726,0,0,0.77778],"10934":[0.25142,0.75726,0,0,0.77778],"10935":[0.26167,0.75726,0,0,0.77778],"10936":[0.26167,0.75726,0,0,0.77778],"10937":[0.26167,0.75726,0,0,0.77778],"10938":[0.26167,0.75726,0,0,0.77778],"10949":[0.25583,0.75583,0,0,0.77778],"10950":[0.25583,0.75583,0,0,0.77778],"10955":[0.28481,0.79383,0,0,0.77778],"10956":[0.28481,0.79383,0,0,0.77778],"57350":[0.08167,0.58167,0,0,0.22222],"57351":[0.08167,0.58167,0,0,0.38889],"57352":[0.08167,0.58167,0,0,0.77778],"57353":[0,0.43056,0.04028,0,0.66667],"57356":[0.25142,0.75726,0,0,0.77778],"57357":[0.25142,0.75726,0,0,0.77778],"57358":[0.41951,0.91951,0,0,0.77778],"57359":[0.30274,0.79383,0,0,0.77778],"57360":[0.30274,0.79383,0,0,0.77778],"57361":[0.41951,0.91951,0,0,0.77778],"57366":[0.25142,0.75726,0,0,0.77778],"57367":[0.25142,0.75726,0,0,0.77778],"57368":[0.25142,0.75726,0,0,0.77778],"57369":[0.25142,0.75726,0,0,0.77778],"57370":[0.13597,0.63597,0,0,0.77778],"57371":[0.13597,0.63597,0,0,0.77778]},"Caligraphic-Regular":{"48":[0,0.43056,0,0,0.5],"49":[0,0.43056,0,0,0.5],"50":[0,0.43056,0,0,0.5],"51":[0.19444,0.43056,0,0,0.5],"52":[0.19444,0.43056,0,0,0.5],"53":[0.19444,0.43056,0,0,0.5],"54":[0,0.64444,0,0,0.5],"55":[0.19444,0.43056,0,0,0.5],"56":[0,0.64444,0,0,0.5],"57":[0.19444,0.43056,0,0,0.5],"65":[0,0.68333,0,0.19445,0.79847],"66":[0,0.68333,0.03041,0.13889,0.65681],"67":[0,0.68333,0.05834,0.13889,0.52653],"68":[0,0.68333,0.02778,0.08334,0.77139],"69":[0,0.68333,0.08944,0.11111,0.52778],"70":[0,0.68333,0.09931,0.11111,0.71875],"71":[0.09722,0.68333,0.0593,0.11111,0.59487],"72":[0,0.68333,0.00965,0.11111,0.84452],"73":[0,0.68333,0.07382,0,0.54452],"74":[0.09722,0.68333,0.18472,0.16667,0.67778],"75":[0,0.68333,0.01445,0.05556,0.76195],"76":[0,0.68333,0,0.13889,0.68972],"77":[0,0.68333,0,0.13889,1.2009],"78":[0,0.68333,0.14736,0.08334,0.82049],"79":[0,0.68333,0.02778,0.11111,0.79611],"80":[0,0.68333,0.08222,0.08334,0.69556],"81":[0.09722,0.68333,0,0.11111,0.81667],"82":[0,0.68333,0,0.08334,0.8475],"83":[0,0.68333,0.075,0.13889,0.60556],"84":[0,0.68333,0.25417,0,0.54464],"85":[0,0.68333,0.09931,0.08334,0.62583],"86":[0,0.68333,0.08222,0,0.61278],"87":[0,0.68333,0.08222,0.08334,0.98778],"88":[0,0.68333,0.14643,0.13889,0.7133],"89":[0.09722,0.68333,0.08222,0.08334,0.66834],"90":[0,0.68333,0.07944,0.13889,0.72473]},"Fraktur-Regular":{"33":[0,0.69141,0,0,0.29574],"34":[0,0.69141,0,0,0.21471],"38":[0,0.69141,0,0,0.73786],"39":[0,0.69141,0,0,0.21201],"40":[0.24982,0.74947,0,0,0.38865],"41":[0.24982,0.74947,0,0,0.38865],"42":[0,0.62119,0,0,0.27764],"43":[0.08319,0.58283,0,0,0.75623],"44":[0,0.10803,0,0,0.27764],"45":[0.08319,0.58283,0,0,0.75623],"46":[0,0.10803,0,0,0.27764],"47":[0.24982,0.74947,0,0,0.50181],"48":[0,0.47534,0,0,0.50181],"49":[0,0.47534,0,0,0.50181],"50":[0,0.47534,0,0,0.50181],"51":[0.18906,0.47534,0,0,0.50181],"52":[0.18906,0.47534,0,0,0.50181],"53":[0.18906,0.47534,0,0,0.50181],"54":[0,0.69141,0,0,0.50181],"55":[0.18906,0.47534,0,0,0.50181],"56":[0,0.69141,0,0,0.50181],"57":[0.18906,0.47534,0,0,0.50181],"58":[0,0.47534,0,0,0.21606],"59":[0.12604,0.47534,0,0,0.21606],"61":[-0.13099,0.36866,0,0,0.75623],"63":[0,0.69141,0,0,0.36245],"65":[0,0.69141,0,0,0.7176],"66":[0,0.69141,0,0,0.88397],"67":[0,0.69141,0,0,0.61254],"68":[0,0.69141,0,0,0.83158],"69":[0,0.69141,0,0,0.66278],"70":[0.12604,0.69141,0,0,0.61119],"71":[0,0.69141,0,0,0.78539],"72":[0.06302,0.69141,0,0,0.7203],"73":[0,0.69141,0,0,0.55448],"74":[0.12604,0.69141,0,0,0.55231],"75":[0,0.69141,0,0,0.66845],"76":[0,0.69141,0,0,0.66602],"77":[0,0.69141,0,0,1.04953],"78":[0,0.69141,0,0,0.83212],"79":[0,0.69141,0,0,0.82699],"80":[0.18906,0.69141,0,0,0.82753],"81":[0.03781,0.69141,0,0,0.82699],"82":[0,0.69141,0,0,0.82807],"83":[0,0.69141,0,0,0.82861],"84":[0,0.69141,0,0,0.66899],"85":[0,0.69141,0,0,0.64576],"86":[0,0.69141,0,0,0.83131],"87":[0,0.69141,0,0,1.04602],"88":[0,0.69141,0,0,0.71922],"89":[0.18906,0.69141,0,0,0.83293],"90":[0.12604,0.69141,0,0,0.60201],"91":[0.24982,0.74947,0,0,0.27764],"93":[0.24982,0.74947,0,0,0.27764],"94":[0,0.69141,0,0,0.49965],"97":[0,0.47534,0,0,0.50046],"98":[0,0.69141,0,0,0.51315],"99":[0,0.47534,0,0,0.38946],"100":[0,0.62119,0,0,0.49857],"101":[0,0.47534,0,0,0.40053],"102":[0.18906,0.69141,0,0,0.32626],"103":[0.18906,0.47534,0,0,0.5037],"104":[0.18906,0.69141,0,0,0.52126],"105":[0,0.69141,0,0,0.27899],"106":[0,0.69141,0,0,0.28088],"107":[0,0.69141,0,0,0.38946],"108":[0,0.69141,0,0,0.27953],"109":[0,0.47534,0,0,0.76676],"110":[0,0.47534,0,0,0.52666],"111":[0,0.47534,0,0,0.48885],"112":[0.18906,0.52396,0,0,0.50046],"113":[0.18906,0.47534,0,0,0.48912],"114":[0,0.47534,0,0,0.38919],"115":[0,0.47534,0,0,0.44266],"116":[0,0.62119,0,0,0.33301],"117":[0,0.47534,0,0,0.5172],"118":[0,0.52396,0,0,0.5118],"119":[0,0.52396,0,0,0.77351],"120":[0.18906,0.47534,0,0,0.38865],"121":[0.18906,0.47534,0,0,0.49884],"122":[0.18906,0.47534,0,0,0.39054],"8216":[0,0.69141,0,0,0.21471],"8217":[0,0.69141,0,0,0.21471],"58112":[0,0.62119,0,0,0.49749],"58113":[0,0.62119,0,0,0.4983],"58114":[0.18906,0.69141,0,0,0.33328],"58115":[0.18906,0.69141,0,0,0.32923],"58116":[0.18906,0.47534,0,0,0.50343],"58117":[0,0.69141,0,0,0.33301],"58118":[0,0.62119,0,0,0.33409],"58119":[0,0.47534,0,0,0.50073]},"Main-Bold":{"33":[0,0.69444,0,0,0.35],"34":[0,0.69444,0,0,0.60278],"35":[0.19444,0.69444,0,0,0.95833],"36":[0.05556,0.75,0,0,0.575],"37":[0.05556,0.75,0,0,0.95833],"38":[0,0.69444,0,0,0.89444],"39":[0,0.69444,0,0,0.31944],"40":[0.25,0.75,0,0,0.44722],"41":[0.25,0.75,0,0,0.44722],"42":[0,0.75,0,0,0.575],"43":[0.13333,0.63333,0,0,0.89444],"44":[0.19444,0.15556,0,0,0.31944],"45":[0,0.44444,0,0,0.38333],"46":[0,0.15556,0,0,0.31944],"47":[0.25,0.75,0,0,0.575],"48":[0,0.64444,0,0,0.575],"49":[0,0.64444,0,0,0.575],"50":[0,0.64444,0,0,0.575],"51":[0,0.64444,0,0,0.575],"52":[0,0.64444,0,0,0.575],"53":[0,0.64444,0,0,0.575],"54":[0,0.64444,0,0,0.575],"55":[0,0.64444,0,0,0.575],"56":[0,0.64444,0,0,0.575],"57":[0,0.64444,0,0,0.575],"58":[0,0.44444,0,0,0.31944],"59":[0.19444,0.44444,0,0,0.31944],"60":[0.08556,0.58556,0,0,0.89444],"61":[-0.10889,0.39111,0,0,0.89444],"62":[0.08556,0.58556,0,0,0.89444],"63":[0,0.69444,0,0,0.54305],"64":[0,0.69444,0,0,0.89444],"65":[0,0.68611,0,0,0.86944],"66":[0,0.68611,0,0,0.81805],"67":[0,0.68611,0,0,0.83055],"68":[0,0.68611,0,0,0.88194],"69":[0,0.68611,0,0,0.75555],"70":[0,0.68611,0,0,0.72361],"71":[0,0.68611,0,0,0.90416],"72":[0,0.68611,0,0,0.9],"73":[0,0.68611,0,0,0.43611],"74":[0,0.68611,0,0,0.59444],"75":[0,0.68611,0,0,0.90138],"76":[0,0.68611,0,0,0.69166],"77":[0,0.68611,0,0,1.09166],"78":[0,0.68611,0,0,0.9],"79":[0,0.68611,0,0,0.86388],"80":[0,0.68611,0,0,0.78611],"81":[0.19444,0.68611,0,0,0.86388],"82":[0,0.68611,0,0,0.8625],"83":[0,0.68611,0,0,0.63889],"84":[0,0.68611,0,0,0.8],"85":[0,0.68611,0,0,0.88472],"86":[0,0.68611,0.01597,0,0.86944],"87":[0,0.68611,0.01597,0,1.18888],"88":[0,0.68611,0,0,0.86944],"89":[0,0.68611,0.02875,0,0.86944],"90":[0,0.68611,0,0,0.70277],"91":[0.25,0.75,0,0,0.31944],"92":[0.25,0.75,0,0,0.575],"93":[0.25,0.75,0,0,0.31944],"94":[0,0.69444,0,0,0.575],"95":[0.31,0.13444,0.03194,0,0.575],"97":[0,0.44444,0,0,0.55902],"98":[0,0.69444,0,0,0.63889],"99":[0,0.44444,0,0,0.51111],"100":[0,0.69444,0,0,0.63889],"101":[0,0.44444,0,0,0.52708],"102":[0,0.69444,0.10903,0,0.35139],"103":[0.19444,0.44444,0.01597,0,0.575],"104":[0,0.69444,0,0,0.63889],"105":[0,0.69444,0,0,0.31944],"106":[0.19444,0.69444,0,0,0.35139],"107":[0,0.69444,0,0,0.60694],"108":[0,0.69444,0,0,0.31944],"109":[0,0.44444,0,0,0.95833],"110":[0,0.44444,0,0,0.63889],"111":[0,0.44444,0,0,0.575],"112":[0.19444,0.44444,0,0,0.63889],"113":[0.19444,0.44444,0,0,0.60694],"114":[0,0.44444,0,0,0.47361],"115":[0,0.44444,0,0,0.45361],"116":[0,0.63492,0,0,0.44722],"117":[0,0.44444,0,0,0.63889],"118":[0,0.44444,0.01597,0,0.60694],"119":[0,0.44444,0.01597,0,0.83055],"120":[0,0.44444,0,0,0.60694],"121":[0.19444,0.44444,0.01597,0,0.60694],"122":[0,0.44444,0,0,0.51111],"123":[0.25,0.75,0,0,0.575],"124":[0.25,0.75,0,0,0.31944],"125":[0.25,0.75,0,0,0.575],"126":[0.35,0.34444,0,0,0.575],"168":[0,0.69444,0,0,0.575],"172":[0,0.44444,0,0,0.76666],"176":[0,0.69444,0,0,0.86944],"177":[0.13333,0.63333,0,0,0.89444],"184":[0.17014,0,0,0,0.51111],"198":[0,0.68611,0,0,1.04166],"215":[0.13333,0.63333,0,0,0.89444],"216":[0.04861,0.73472,0,0,0.89444],"223":[0,0.69444,0,0,0.59722],"230":[0,0.44444,0,0,0.83055],"247":[0.13333,0.63333,0,0,0.89444],"248":[0.09722,0.54167,0,0,0.575],"305":[0,0.44444,0,0,0.31944],"338":[0,0.68611,0,0,1.16944],"339":[0,0.44444,0,0,0.89444],"567":[0.19444,0.44444,0,0,0.35139],"710":[0,0.69444,0,0,0.575],"711":[0,0.63194,0,0,0.575],"713":[0,0.59611,0,0,0.575],"714":[0,0.69444,0,0,0.575],"715":[0,0.69444,0,0,0.575],"728":[0,0.69444,0,0,0.575],"729":[0,0.69444,0,0,0.31944],"730":[0,0.69444,0,0,0.86944],"732":[0,0.69444,0,0,0.575],"733":[0,0.69444,0,0,0.575],"915":[0,0.68611,0,0,0.69166],"916":[0,0.68611,0,0,0.95833],"920":[0,0.68611,0,0,0.89444],"923":[0,0.68611,0,0,0.80555],"926":[0,0.68611,0,0,0.76666],"928":[0,0.68611,0,0,0.9],"931":[0,0.68611,0,0,0.83055],"933":[0,0.68611,0,0,0.89444],"934":[0,0.68611,0,0,0.83055],"936":[0,0.68611,0,0,0.89444],"937":[0,0.68611,0,0,0.83055],"8211":[0,0.44444,0.03194,0,0.575],"8212":[0,0.44444,0.03194,0,1.14999],"8216":[0,0.69444,0,0,0.31944],"8217":[0,0.69444,0,0,0.31944],"8220":[0,0.69444,0,0,0.60278],"8221":[0,0.69444,0,0,0.60278],"8224":[0.19444,0.69444,0,0,0.51111],"8225":[0.19444,0.69444,0,0,0.51111],"8242":[0,0.55556,0,0,0.34444],"8407":[0,0.72444,0.15486,0,0.575],"8463":[0,0.69444,0,0,0.66759],"8465":[0,0.69444,0,0,0.83055],"8467":[0,0.69444,0,0,0.47361],"8472":[0.19444,0.44444,0,0,0.74027],"8476":[0,0.69444,0,0,0.83055],"8501":[0,0.69444,0,0,0.70277],"8592":[-0.10889,0.39111,0,0,1.14999],"8593":[0.19444,0.69444,0,0,0.575],"8594":[-0.10889,0.39111,0,0,1.14999],"8595":[0.19444,0.69444,0,0,0.575],"8596":[-0.10889,0.39111,0,0,1.14999],"8597":[0.25,0.75,0,0,0.575],"8598":[0.19444,0.69444,0,0,1.14999],"8599":[0.19444,0.69444,0,0,1.14999],"8600":[0.19444,0.69444,0,0,1.14999],"8601":[0.19444,0.69444,0,0,1.14999],"8636":[-0.10889,0.39111,0,0,1.14999],"8637":[-0.10889,0.39111,0,0,1.14999],"8640":[-0.10889,0.39111,0,0,1.14999],"8641":[-0.10889,0.39111,0,0,1.14999],"8656":[-0.10889,0.39111,0,0,1.14999],"8657":[0.19444,0.69444,0,0,0.70277],"8658":[-0.10889,0.39111,0,0,1.14999],"8659":[0.19444,0.69444,0,0,0.70277],"8660":[-0.10889,0.39111,0,0,1.14999],"8661":[0.25,0.75,0,0,0.70277],"8704":[0,0.69444,0,0,0.63889],"8706":[0,0.69444,0.06389,0,0.62847],"8707":[0,0.69444,0,0,0.63889],"8709":[0.05556,0.75,0,0,0.575],"8711":[0,0.68611,0,0,0.95833],"8712":[0.08556,0.58556,0,0,0.76666],"8715":[0.08556,0.58556,0,0,0.76666],"8722":[0.13333,0.63333,0,0,0.89444],"8723":[0.13333,0.63333,0,0,0.89444],"8725":[0.25,0.75,0,0,0.575],"8726":[0.25,0.75,0,0,0.575],"8727":[-0.02778,0.47222,0,0,0.575],"8728":[-0.02639,0.47361,0,0,0.575],"8729":[-0.02639,0.47361,0,0,0.575],"8730":[0.18,0.82,0,0,0.95833],"8733":[0,0.44444,0,0,0.89444],"8734":[0,0.44444,0,0,1.14999],"8736":[0,0.69224,0,0,0.72222],"8739":[0.25,0.75,0,0,0.31944],"8741":[0.25,0.75,0,0,0.575],"8743":[0,0.55556,0,0,0.76666],"8744":[0,0.55556,0,0,0.76666],"8745":[0,0.55556,0,0,0.76666],"8746":[0,0.55556,0,0,0.76666],"8747":[0.19444,0.69444,0.12778,0,0.56875],"8764":[-0.10889,0.39111,0,0,0.89444],"8768":[0.19444,0.69444,0,0,0.31944],"8771":[0.00222,0.50222,0,0,0.89444],"8776":[0.02444,0.52444,0,0,0.89444],"8781":[0.00222,0.50222,0,0,0.89444],"8801":[0.00222,0.50222,0,0,0.89444],"8804":[0.19667,0.69667,0,0,0.89444],"8805":[0.19667,0.69667,0,0,0.89444],"8810":[0.08556,0.58556,0,0,1.14999],"8811":[0.08556,0.58556,0,0,1.14999],"8826":[0.08556,0.58556,0,0,0.89444],"8827":[0.08556,0.58556,0,0,0.89444],"8834":[0.08556,0.58556,0,0,0.89444],"8835":[0.08556,0.58556,0,0,0.89444],"8838":[0.19667,0.69667,0,0,0.89444],"8839":[0.19667,0.69667,0,0,0.89444],"8846":[0,0.55556,0,0,0.76666],"8849":[0.19667,0.69667,0,0,0.89444],"8850":[0.19667,0.69667,0,0,0.89444],"8851":[0,0.55556,0,0,0.76666],"8852":[0,0.55556,0,0,0.76666],"8853":[0.13333,0.63333,0,0,0.89444],"8854":[0.13333,0.63333,0,0,0.89444],"8855":[0.13333,0.63333,0,0,0.89444],"8856":[0.13333,0.63333,0,0,0.89444],"8857":[0.13333,0.63333,0,0,0.89444],"8866":[0,0.69444,0,0,0.70277],"8867":[0,0.69444,0,0,0.70277],"8868":[0,0.69444,0,0,0.89444],"8869":[0,0.69444,0,0,0.89444],"8900":[-0.02639,0.47361,0,0,0.575],"8901":[-0.02639,0.47361,0,0,0.31944],"8902":[-0.02778,0.47222,0,0,0.575],"8968":[0.25,0.75,0,0,0.51111],"8969":[0.25,0.75,0,0,0.51111],"8970":[0.25,0.75,0,0,0.51111],"8971":[0.25,0.75,0,0,0.51111],"8994":[-0.13889,0.36111,0,0,1.14999],"8995":[-0.13889,0.36111,0,0,1.14999],"9651":[0.19444,0.69444,0,0,1.02222],"9657":[-0.02778,0.47222,0,0,0.575],"9661":[0.19444,0.69444,0,0,1.02222],"9667":[-0.02778,0.47222,0,0,0.575],"9711":[0.19444,0.69444,0,0,1.14999],"9824":[0.12963,0.69444,0,0,0.89444],"9825":[0.12963,0.69444,0,0,0.89444],"9826":[0.12963,0.69444,0,0,0.89444],"9827":[0.12963,0.69444,0,0,0.89444],"9837":[0,0.75,0,0,0.44722],"9838":[0.19444,0.69444,0,0,0.44722],"9839":[0.19444,0.69444,0,0,0.44722],"10216":[0.25,0.75,0,0,0.44722],"10217":[0.25,0.75,0,0,0.44722],"10815":[0,0.68611,0,0,0.9],"10927":[0.19667,0.69667,0,0,0.89444],"10928":[0.19667,0.69667,0,0,0.89444],"57376":[0.19444,0.69444,0,0,0]},"Main-BoldItalic":{"33":[0,0.69444,0.11417,0,0.38611],"34":[0,0.69444,0.07939,0,0.62055],"35":[0.19444,0.69444,0.06833,0,0.94444],"37":[0.05556,0.75,0.12861,0,0.94444],"38":[0,0.69444,0.08528,0,0.88555],"39":[0,0.69444,0.12945,0,0.35555],"40":[0.25,0.75,0.15806,0,0.47333],"41":[0.25,0.75,0.03306,0,0.47333],"42":[0,0.75,0.14333,0,0.59111],"43":[0.10333,0.60333,0.03306,0,0.88555],"44":[0.19444,0.14722,0,0,0.35555],"45":[0,0.44444,0.02611,0,0.41444],"46":[0,0.14722,0,0,0.35555],"47":[0.25,0.75,0.15806,0,0.59111],"48":[0,0.64444,0.13167,0,0.59111],"49":[0,0.64444,0.13167,0,0.59111],"50":[0,0.64444,0.13167,0,0.59111],"51":[0,0.64444,0.13167,0,0.59111],"52":[0.19444,0.64444,0.13167,0,0.59111],"53":[0,0.64444,0.13167,0,0.59111],"54":[0,0.64444,0.13167,0,0.59111],"55":[0.19444,0.64444,0.13167,0,0.59111],"56":[0,0.64444,0.13167,0,0.59111],"57":[0,0.64444,0.13167,0,0.59111],"58":[0,0.44444,0.06695,0,0.35555],"59":[0.19444,0.44444,0.06695,0,0.35555],"61":[-0.10889,0.39111,0.06833,0,0.88555],"63":[0,0.69444,0.11472,0,0.59111],"64":[0,0.69444,0.09208,0,0.88555],"65":[0,0.68611,0,0,0.86555],"66":[0,0.68611,0.0992,0,0.81666],"67":[0,0.68611,0.14208,0,0.82666],"68":[0,0.68611,0.09062,0,0.87555],"69":[0,0.68611,0.11431,0,0.75666],"70":[0,0.68611,0.12903,0,0.72722],"71":[0,0.68611,0.07347,0,0.89527],"72":[0,0.68611,0.17208,0,0.8961],"73":[0,0.68611,0.15681,0,0.47166],"74":[0,0.68611,0.145,0,0.61055],"75":[0,0.68611,0.14208,0,0.89499],"76":[0,0.68611,0,0,0.69777],"77":[0,0.68611,0.17208,0,1.07277],"78":[0,0.68611,0.17208,0,0.8961],"79":[0,0.68611,0.09062,0,0.85499],"80":[0,0.68611,0.0992,0,0.78721],"81":[0.19444,0.68611,0.09062,0,0.85499],"82":[0,0.68611,0.02559,0,0.85944],"83":[0,0.68611,0.11264,0,0.64999],"84":[0,0.68611,0.12903,0,0.7961],"85":[0,0.68611,0.17208,0,0.88083],"86":[0,0.68611,0.18625,0,0.86555],"87":[0,0.68611,0.18625,0,1.15999],"88":[0,0.68611,0.15681,0,0.86555],"89":[0,0.68611,0.19803,0,0.86555],"90":[0,0.68611,0.14208,0,0.70888],"91":[0.25,0.75,0.1875,0,0.35611],"93":[0.25,0.75,0.09972,0,0.35611],"94":[0,0.69444,0.06709,0,0.59111],"95":[0.31,0.13444,0.09811,0,0.59111],"97":[0,0.44444,0.09426,0,0.59111],"98":[0,0.69444,0.07861,0,0.53222],"99":[0,0.44444,0.05222,0,0.53222],"100":[0,0.69444,0.10861,0,0.59111],"101":[0,0.44444,0.085,0,0.53222],"102":[0.19444,0.69444,0.21778,0,0.4],"103":[0.19444,0.44444,0.105,0,0.53222],"104":[0,0.69444,0.09426,0,0.59111],"105":[0,0.69326,0.11387,0,0.35555],"106":[0.19444,0.69326,0.1672,0,0.35555],"107":[0,0.69444,0.11111,0,0.53222],"108":[0,0.69444,0.10861,0,0.29666],"109":[0,0.44444,0.09426,0,0.94444],"110":[0,0.44444,0.09426,0,0.64999],"111":[0,0.44444,0.07861,0,0.59111],"112":[0.19444,0.44444,0.07861,0,0.59111],"113":[0.19444,0.44444,0.105,0,0.53222],"114":[0,0.44444,0.11111,0,0.50167],"115":[0,0.44444,0.08167,0,0.48694],"116":[0,0.63492,0.09639,0,0.385],"117":[0,0.44444,0.09426,0,0.62055],"118":[0,0.44444,0.11111,0,0.53222],"119":[0,0.44444,0.11111,0,0.76777],"120":[0,0.44444,0.12583,0,0.56055],"121":[0.19444,0.44444,0.105,0,0.56166],"122":[0,0.44444,0.13889,0,0.49055],"126":[0.35,0.34444,0.11472,0,0.59111],"163":[0,0.69444,0,0,0.86853],"168":[0,0.69444,0.11473,0,0.59111],"176":[0,0.69444,0,0,0.94888],"184":[0.17014,0,0,0,0.53222],"198":[0,0.68611,0.11431,0,1.02277],"216":[0.04861,0.73472,0.09062,0,0.88555],"223":[0.19444,0.69444,0.09736,0,0.665],"230":[0,0.44444,0.085,0,0.82666],"248":[0.09722,0.54167,0.09458,0,0.59111],"305":[0,0.44444,0.09426,0,0.35555],"338":[0,0.68611,0.11431,0,1.14054],"339":[0,0.44444,0.085,0,0.82666],"567":[0.19444,0.44444,0.04611,0,0.385],"710":[0,0.69444,0.06709,0,0.59111],"711":[0,0.63194,0.08271,0,0.59111],"713":[0,0.59444,0.10444,0,0.59111],"714":[0,0.69444,0.08528,0,0.59111],"715":[0,0.69444,0,0,0.59111],"728":[0,0.69444,0.10333,0,0.59111],"729":[0,0.69444,0.12945,0,0.35555],"730":[0,0.69444,0,0,0.94888],"732":[0,0.69444,0.11472,0,0.59111],"733":[0,0.69444,0.11472,0,0.59111],"915":[0,0.68611,0.12903,0,0.69777],"916":[0,0.68611,0,0,0.94444],"920":[0,0.68611,0.09062,0,0.88555],"923":[0,0.68611,0,0,0.80666],"926":[0,0.68611,0.15092,0,0.76777],"928":[0,0.68611,0.17208,0,0.8961],"931":[0,0.68611,0.11431,0,0.82666],"933":[0,0.68611,0.10778,0,0.88555],"934":[0,0.68611,0.05632,0,0.82666],"936":[0,0.68611,0.10778,0,0.88555],"937":[0,0.68611,0.0992,0,0.82666],"8211":[0,0.44444,0.09811,0,0.59111],"8212":[0,0.44444,0.09811,0,1.18221],"8216":[0,0.69444,0.12945,0,0.35555],"8217":[0,0.69444,0.12945,0,0.35555],"8220":[0,0.69444,0.16772,0,0.62055],"8221":[0,0.69444,0.07939,0,0.62055]},"Main-Italic":{"33":[0,0.69444,0.12417,0,0.30667],"34":[0,0.69444,0.06961,0,0.51444],"35":[0.19444,0.69444,0.06616,0,0.81777],"37":[0.05556,0.75,0.13639,0,0.81777],"38":[0,0.69444,0.09694,0,0.76666],"39":[0,0.69444,0.12417,0,0.30667],"40":[0.25,0.75,0.16194,0,0.40889],"41":[0.25,0.75,0.03694,0,0.40889],"42":[0,0.75,0.14917,0,0.51111],"43":[0.05667,0.56167,0.03694,0,0.76666],"44":[0.19444,0.10556,0,0,0.30667],"45":[0,0.43056,0.02826,0,0.35778],"46":[0,0.10556,0,0,0.30667],"47":[0.25,0.75,0.16194,0,0.51111],"48":[0,0.64444,0.13556,0,0.51111],"49":[0,0.64444,0.13556,0,0.51111],"50":[0,0.64444,0.13556,0,0.51111],"51":[0,0.64444,0.13556,0,0.51111],"52":[0.19444,0.64444,0.13556,0,0.51111],"53":[0,0.64444,0.13556,0,0.51111],"54":[0,0.64444,0.13556,0,0.51111],"55":[0.19444,0.64444,0.13556,0,0.51111],"56":[0,0.64444,0.13556,0,0.51111],"57":[0,0.64444,0.13556,0,0.51111],"58":[0,0.43056,0.0582,0,0.30667],"59":[0.19444,0.43056,0.0582,0,0.30667],"61":[-0.13313,0.36687,0.06616,0,0.76666],"63":[0,0.69444,0.1225,0,0.51111],"64":[0,0.69444,0.09597,0,0.76666],"65":[0,0.68333,0,0,0.74333],"66":[0,0.68333,0.10257,0,0.70389],"67":[0,0.68333,0.14528,0,0.71555],"68":[0,0.68333,0.09403,0,0.755],"69":[0,0.68333,0.12028,0,0.67833],"70":[0,0.68333,0.13305,0,0.65277],"71":[0,0.68333,0.08722,0,0.77361],"72":[0,0.68333,0.16389,0,0.74333],"73":[0,0.68333,0.15806,0,0.38555],"74":[0,0.68333,0.14028,0,0.525],"75":[0,0.68333,0.14528,0,0.76888],"76":[0,0.68333,0,0,0.62722],"77":[0,0.68333,0.16389,0,0.89666],"78":[0,0.68333,0.16389,0,0.74333],"79":[0,0.68333,0.09403,0,0.76666],"80":[0,0.68333,0.10257,0,0.67833],"81":[0.19444,0.68333,0.09403,0,0.76666],"82":[0,0.68333,0.03868,0,0.72944],"83":[0,0.68333,0.11972,0,0.56222],"84":[0,0.68333,0.13305,0,0.71555],"85":[0,0.68333,0.16389,0,0.74333],"86":[0,0.68333,0.18361,0,0.74333],"87":[0,0.68333,0.18361,0,0.99888],"88":[0,0.68333,0.15806,0,0.74333],"89":[0,0.68333,0.19383,0,0.74333],"90":[0,0.68333,0.14528,0,0.61333],"91":[0.25,0.75,0.1875,0,0.30667],"93":[0.25,0.75,0.10528,0,0.30667],"94":[0,0.69444,0.06646,0,0.51111],"95":[0.31,0.12056,0.09208,0,0.51111],"97":[0,0.43056,0.07671,0,0.51111],"98":[0,0.69444,0.06312,0,0.46],"99":[0,0.43056,0.05653,0,0.46],"100":[0,0.69444,0.10333,0,0.51111],"101":[0,0.43056,0.07514,0,0.46],"102":[0.19444,0.69444,0.21194,0,0.30667],"103":[0.19444,0.43056,0.08847,0,0.46],"104":[0,0.69444,0.07671,0,0.51111],"105":[0,0.65536,0.1019,0,0.30667],"106":[0.19444,0.65536,0.14467,0,0.30667],"107":[0,0.69444,0.10764,0,0.46],"108":[0,0.69444,0.10333,0,0.25555],"109":[0,0.43056,0.07671,0,0.81777],"110":[0,0.43056,0.07671,0,0.56222],"111":[0,0.43056,0.06312,0,0.51111],"112":[0.19444,0.43056,0.06312,0,0.51111],"113":[0.19444,0.43056,0.08847,0,0.46],"114":[0,0.43056,0.10764,0,0.42166],"115":[0,0.43056,0.08208,0,0.40889],"116":[0,0.61508,0.09486,0,0.33222],"117":[0,0.43056,0.07671,0,0.53666],"118":[0,0.43056,0.10764,0,0.46],"119":[0,0.43056,0.10764,0,0.66444],"120":[0,0.43056,0.12042,0,0.46389],"121":[0.19444,0.43056,0.08847,0,0.48555],"122":[0,0.43056,0.12292,0,0.40889],"126":[0.35,0.31786,0.11585,0,0.51111],"163":[0,0.69444,0,0,0.76909],"168":[0,0.66786,0.10474,0,0.51111],"176":[0,0.69444,0,0,0.83129],"184":[0.17014,0,0,0,0.46],"198":[0,0.68333,0.12028,0,0.88277],"216":[0.04861,0.73194,0.09403,0,0.76666],"223":[0.19444,0.69444,0.10514,0,0.53666],"230":[0,0.43056,0.07514,0,0.71555],"248":[0.09722,0.52778,0.09194,0,0.51111],"305":[0,0.43056,0,0.02778,0.32246],"338":[0,0.68333,0.12028,0,0.98499],"339":[0,0.43056,0.07514,0,0.71555],"567":[0.19444,0.43056,0,0.08334,0.38403],"710":[0,0.69444,0.06646,0,0.51111],"711":[0,0.62847,0.08295,0,0.51111],"713":[0,0.56167,0.10333,0,0.51111],"714":[0,0.69444,0.09694,0,0.51111],"715":[0,0.69444,0,0,0.51111],"728":[0,0.69444,0.10806,0,0.51111],"729":[0,0.66786,0.11752,0,0.30667],"730":[0,0.69444,0,0,0.83129],"732":[0,0.66786,0.11585,0,0.51111],"733":[0,0.69444,0.1225,0,0.51111],"915":[0,0.68333,0.13305,0,0.62722],"916":[0,0.68333,0,0,0.81777],"920":[0,0.68333,0.09403,0,0.76666],"923":[0,0.68333,0,0,0.69222],"926":[0,0.68333,0.15294,0,0.66444],"928":[0,0.68333,0.16389,0,0.74333],"931":[0,0.68333,0.12028,0,0.71555],"933":[0,0.68333,0.11111,0,0.76666],"934":[0,0.68333,0.05986,0,0.71555],"936":[0,0.68333,0.11111,0,0.76666],"937":[0,0.68333,0.10257,0,0.71555],"8211":[0,0.43056,0.09208,0,0.51111],"8212":[0,0.43056,0.09208,0,1.02222],"8216":[0,0.69444,0.12417,0,0.30667],"8217":[0,0.69444,0.12417,0,0.30667],"8220":[0,0.69444,0.1685,0,0.51444],"8221":[0,0.69444,0.06961,0,0.51444],"8463":[0,0.68889,0,0,0.54028]},"Main-Regular":{"32":[0,0,0,0,0.25],"33":[0,0.69444,0,0,0.27778],"34":[0,0.69444,0,0,0.5],"35":[0.19444,0.69444,0,0,0.83334],"36":[0.05556,0.75,0,0,0.5],"37":[0.05556,0.75,0,0,0.83334],"38":[0,0.69444,0,0,0.77778],"39":[0,0.69444,0,0,0.27778],"40":[0.25,0.75,0,0,0.38889],"41":[0.25,0.75,0,0,0.38889],"42":[0,0.75,0,0,0.5],"43":[0.08333,0.58333,0,0,0.77778],"44":[0.19444,0.10556,0,0,0.27778],"45":[0,0.43056,0,0,0.33333],"46":[0,0.10556,0,0,0.27778],"47":[0.25,0.75,0,0,0.5],"48":[0,0.64444,0,0,0.5],"49":[0,0.64444,0,0,0.5],"50":[0,0.64444,0,0,0.5],"51":[0,0.64444,0,0,0.5],"52":[0,0.64444,0,0,0.5],"53":[0,0.64444,0,0,0.5],"54":[0,0.64444,0,0,0.5],"55":[0,0.64444,0,0,0.5],"56":[0,0.64444,0,0,0.5],"57":[0,0.64444,0,0,0.5],"58":[0,0.43056,0,0,0.27778],"59":[0.19444,0.43056,0,0,0.27778],"60":[0.0391,0.5391,0,0,0.77778],"61":[-0.13313,0.36687,0,0,0.77778],"62":[0.0391,0.5391,0,0,0.77778],"63":[0,0.69444,0,0,0.47222],"64":[0,0.69444,0,0,0.77778],"65":[0,0.68333,0,0,0.75],"66":[0,0.68333,0,0,0.70834],"67":[0,0.68333,0,0,0.72222],"68":[0,0.68333,0,0,0.76389],"69":[0,0.68333,0,0,0.68056],"70":[0,0.68333,0,0,0.65278],"71":[0,0.68333,0,0,0.78472],"72":[0,0.68333,0,0,0.75],"73":[0,0.68333,0,0,0.36111],"74":[0,0.68333,0,0,0.51389],"75":[0,0.68333,0,0,0.77778],"76":[0,0.68333,0,0,0.625],"77":[0,0.68333,0,0,0.91667],"78":[0,0.68333,0,0,0.75],"79":[0,0.68333,0,0,0.77778],"80":[0,0.68333,0,0,0.68056],"81":[0.19444,0.68333,0,0,0.77778],"82":[0,0.68333,0,0,0.73611],"83":[0,0.68333,0,0,0.55556],"84":[0,0.68333,0,0,0.72222],"85":[0,0.68333,0,0,0.75],"86":[0,0.68333,0.01389,0,0.75],"87":[0,0.68333,0.01389,0,1.02778],"88":[0,0.68333,0,0,0.75],"89":[0,0.68333,0.025,0,0.75],"90":[0,0.68333,0,0,0.61111],"91":[0.25,0.75,0,0,0.27778],"92":[0.25,0.75,0,0,0.5],"93":[0.25,0.75,0,0,0.27778],"94":[0,0.69444,0,0,0.5],"95":[0.31,0.12056,0.02778,0,0.5],"97":[0,0.43056,0,0,0.5],"98":[0,0.69444,0,0,0.55556],"99":[0,0.43056,0,0,0.44445],"100":[0,0.69444,0,0,0.55556],"101":[0,0.43056,0,0,0.44445],"102":[0,0.69444,0.07778,0,0.30556],"103":[0.19444,0.43056,0.01389,0,0.5],"104":[0,0.69444,0,0,0.55556],"105":[0,0.66786,0,0,0.27778],"106":[0.19444,0.66786,0,0,0.30556],"107":[0,0.69444,0,0,0.52778],"108":[0,0.69444,0,0,0.27778],"109":[0,0.43056,0,0,0.83334],"110":[0,0.43056,0,0,0.55556],"111":[0,0.43056,0,0,0.5],"112":[0.19444,0.43056,0,0,0.55556],"113":[0.19444,0.43056,0,0,0.52778],"114":[0,0.43056,0,0,0.39167],"115":[0,0.43056,0,0,0.39445],"116":[0,0.61508,0,0,0.38889],"117":[0,0.43056,0,0,0.55556],"118":[0,0.43056,0.01389,0,0.52778],"119":[0,0.43056,0.01389,0,0.72222],"120":[0,0.43056,0,0,0.52778],"121":[0.19444,0.43056,0.01389,0,0.52778],"122":[0,0.43056,0,0,0.44445],"123":[0.25,0.75,0,0,0.5],"124":[0.25,0.75,0,0,0.27778],"125":[0.25,0.75,0,0,0.5],"126":[0.35,0.31786,0,0,0.5],"160":[0,0,0,0,0.25],"167":[0.19444,0.69444,0,0,0.44445],"168":[0,0.66786,0,0,0.5],"172":[0,0.43056,0,0,0.66667],"176":[0,0.69444,0,0,0.75],"177":[0.08333,0.58333,0,0,0.77778],"182":[0.19444,0.69444,0,0,0.61111],"184":[0.17014,0,0,0,0.44445],"198":[0,0.68333,0,0,0.90278],"215":[0.08333,0.58333,0,0,0.77778],"216":[0.04861,0.73194,0,0,0.77778],"223":[0,0.69444,0,0,0.5],"230":[0,0.43056,0,0,0.72222],"247":[0.08333,0.58333,0,0,0.77778],"248":[0.09722,0.52778,0,0,0.5],"305":[0,0.43056,0,0,0.27778],"338":[0,0.68333,0,0,1.01389],"339":[0,0.43056,0,0,0.77778],"567":[0.19444,0.43056,0,0,0.30556],"710":[0,0.69444,0,0,0.5],"711":[0,0.62847,0,0,0.5],"713":[0,0.56778,0,0,0.5],"714":[0,0.69444,0,0,0.5],"715":[0,0.69444,0,0,0.5],"728":[0,0.69444,0,0,0.5],"729":[0,0.66786,0,0,0.27778],"730":[0,0.69444,0,0,0.75],"732":[0,0.66786,0,0,0.5],"733":[0,0.69444,0,0,0.5],"915":[0,0.68333,0,0,0.625],"916":[0,0.68333,0,0,0.83334],"920":[0,0.68333,0,0,0.77778],"923":[0,0.68333,0,0,0.69445],"926":[0,0.68333,0,0,0.66667],"928":[0,0.68333,0,0,0.75],"931":[0,0.68333,0,0,0.72222],"933":[0,0.68333,0,0,0.77778],"934":[0,0.68333,0,0,0.72222],"936":[0,0.68333,0,0,0.77778],"937":[0,0.68333,0,0,0.72222],"8211":[0,0.43056,0.02778,0,0.5],"8212":[0,0.43056,0.02778,0,1.0],"8216":[0,0.69444,0,0,0.27778],"8217":[0,0.69444,0,0,0.27778],"8220":[0,0.69444,0,0,0.5],"8221":[0,0.69444,0,0,0.5],"8224":[0.19444,0.69444,0,0,0.44445],"8225":[0.19444,0.69444,0,0,0.44445],"8230":[0,0.12,0,0,1.172],"8242":[0,0.55556,0,0,0.275],"8407":[0,0.71444,0.15382,0,0.5],"8463":[0,0.68889,0,0,0.54028],"8465":[0,0.69444,0,0,0.72222],"8467":[0,0.69444,0,0.11111,0.41667],"8472":[0.19444,0.43056,0,0.11111,0.63646],"8476":[0,0.69444,0,0,0.72222],"8501":[0,0.69444,0,0,0.61111],"8592":[-0.13313,0.36687,0,0,1.0],"8593":[0.19444,0.69444,0,0,0.5],"8594":[-0.13313,0.36687,0,0,1.0],"8595":[0.19444,0.69444,0,0,0.5],"8596":[-0.13313,0.36687,0,0,1.0],"8597":[0.25,0.75,0,0,0.5],"8598":[0.19444,0.69444,0,0,1.0],"8599":[0.19444,0.69444,0,0,1.0],"8600":[0.19444,0.69444,0,0,1.0],"8601":[0.19444,0.69444,0,0,1.0],"8614":[0.011,0.511,0,0,1.0],"8617":[0.011,0.511,0,0,1.126],"8618":[0.011,0.511,0,0,1.126],"8636":[-0.13313,0.36687,0,0,1.0],"8637":[-0.13313,0.36687,0,0,1.0],"8640":[-0.13313,0.36687,0,0,1.0],"8641":[-0.13313,0.36687,0,0,1.0],"8652":[0.011,0.671,0,0,1.0],"8656":[-0.13313,0.36687,0,0,1.0],"8657":[0.19444,0.69444,0,0,0.61111],"8658":[-0.13313,0.36687,0,0,1.0],"8659":[0.19444,0.69444,0,0,0.61111],"8660":[-0.13313,0.36687,0,0,1.0],"8661":[0.25,0.75,0,0,0.61111],"8704":[0,0.69444,0,0,0.55556],"8706":[0,0.69444,0.05556,0.08334,0.5309],"8707":[0,0.69444,0,0,0.55556],"8709":[0.05556,0.75,0,0,0.5],"8711":[0,0.68333,0,0,0.83334],"8712":[0.0391,0.5391,0,0,0.66667],"8715":[0.0391,0.5391,0,0,0.66667],"8722":[0.08333,0.58333,0,0,0.77778],"8723":[0.08333,0.58333,0,0,0.77778],"8725":[0.25,0.75,0,0,0.5],"8726":[0.25,0.75,0,0,0.5],"8727":[-0.03472,0.46528,0,0,0.5],"8728":[-0.05555,0.44445,0,0,0.5],"8729":[-0.05555,0.44445,0,0,0.5],"8730":[0.2,0.8,0,0,0.83334],"8733":[0,0.43056,0,0,0.77778],"8734":[0,0.43056,0,0,1.0],"8736":[0,0.69224,0,0,0.72222],"8739":[0.25,0.75,0,0,0.27778],"8741":[0.25,0.75,0,0,0.5],"8743":[0,0.55556,0,0,0.66667],"8744":[0,0.55556,0,0,0.66667],"8745":[0,0.55556,0,0,0.66667],"8746":[0,0.55556,0,0,0.66667],"8747":[0.19444,0.69444,0.11111,0,0.41667],"8764":[-0.13313,0.36687,0,0,0.77778],"8768":[0.19444,0.69444,0,0,0.27778],"8771":[-0.03625,0.46375,0,0,0.77778],"8773":[-0.022,0.589,0,0,1.0],"8776":[-0.01688,0.48312,0,0,0.77778],"8781":[-0.03625,0.46375,0,0,0.77778],"8784":[-0.133,0.67,0,0,0.778],"8801":[-0.03625,0.46375,0,0,0.77778],"8804":[0.13597,0.63597,0,0,0.77778],"8805":[0.13597,0.63597,0,0,0.77778],"8810":[0.0391,0.5391,0,0,1.0],"8811":[0.0391,0.5391,0,0,1.0],"8826":[0.0391,0.5391,0,0,0.77778],"8827":[0.0391,0.5391,0,0,0.77778],"8834":[0.0391,0.5391,0,0,0.77778],"8835":[0.0391,0.5391,0,0,0.77778],"8838":[0.13597,0.63597,0,0,0.77778],"8839":[0.13597,0.63597,0,0,0.77778],"8846":[0,0.55556,0,0,0.66667],"8849":[0.13597,0.63597,0,0,0.77778],"8850":[0.13597,0.63597,0,0,0.77778],"8851":[0,0.55556,0,0,0.66667],"8852":[0,0.55556,0,0,0.66667],"8853":[0.08333,0.58333,0,0,0.77778],"8854":[0.08333,0.58333,0,0,0.77778],"8855":[0.08333,0.58333,0,0,0.77778],"8856":[0.08333,0.58333,0,0,0.77778],"8857":[0.08333,0.58333,0,0,0.77778],"8866":[0,0.69444,0,0,0.61111],"8867":[0,0.69444,0,0,0.61111],"8868":[0,0.69444,0,0,0.77778],"8869":[0,0.69444,0,0,0.77778],"8872":[0.249,0.75,0,0,0.867],"8900":[-0.05555,0.44445,0,0,0.5],"8901":[-0.05555,0.44445,0,0,0.27778],"8902":[-0.03472,0.46528,0,0,0.5],"8904":[0.005,0.505,0,0,0.9],"8942":[0.03,0.9,0,0,0.278],"8943":[-0.19,0.31,0,0,1.172],"8945":[-0.1,0.82,0,0,1.282],"8968":[0.25,0.75,0,0,0.44445],"8969":[0.25,0.75,0,0,0.44445],"8970":[0.25,0.75,0,0,0.44445],"8971":[0.25,0.75,0,0,0.44445],"8994":[-0.14236,0.35764,0,0,1.0],"8995":[-0.14236,0.35764,0,0,1.0],"9136":[0.244,0.744,0,0,0.412],"9137":[0.244,0.744,0,0,0.412],"9651":[0.19444,0.69444,0,0,0.88889],"9657":[-0.03472,0.46528,0,0,0.5],"9661":[0.19444,0.69444,0,0,0.88889],"9667":[-0.03472,0.46528,0,0,0.5],"9711":[0.19444,0.69444,0,0,1.0],"9824":[0.12963,0.69444,0,0,0.77778],"9825":[0.12963,0.69444,0,0,0.77778],"9826":[0.12963,0.69444,0,0,0.77778],"9827":[0.12963,0.69444,0,0,0.77778],"9837":[0,0.75,0,0,0.38889],"9838":[0.19444,0.69444,0,0,0.38889],"9839":[0.19444,0.69444,0,0,0.38889],"10216":[0.25,0.75,0,0,0.38889],"10217":[0.25,0.75,0,0,0.38889],"10222":[0.244,0.744,0,0,0.412],"10223":[0.244,0.744,0,0,0.412],"10229":[0.011,0.511,0,0,1.609],"10230":[0.011,0.511,0,0,1.638],"10231":[0.011,0.511,0,0,1.859],"10232":[0.024,0.525,0,0,1.609],"10233":[0.024,0.525,0,0,1.638],"10234":[0.024,0.525,0,0,1.858],"10236":[0.011,0.511,0,0,1.638],"10815":[0,0.68333,0,0,0.75],"10927":[0.13597,0.63597,0,0,0.77778],"10928":[0.13597,0.63597,0,0,0.77778],"57376":[0.19444,0.69444,0,0,0]},"Math-BoldItalic":{"65":[0,0.68611,0,0,0.86944],"66":[0,0.68611,0.04835,0,0.8664],"67":[0,0.68611,0.06979,0,0.81694],"68":[0,0.68611,0.03194,0,0.93812],"69":[0,0.68611,0.05451,0,0.81007],"70":[0,0.68611,0.15972,0,0.68889],"71":[0,0.68611,0,0,0.88673],"72":[0,0.68611,0.08229,0,0.98229],"73":[0,0.68611,0.07778,0,0.51111],"74":[0,0.68611,0.10069,0,0.63125],"75":[0,0.68611,0.06979,0,0.97118],"76":[0,0.68611,0,0,0.75555],"77":[0,0.68611,0.11424,0,1.14201],"78":[0,0.68611,0.11424,0,0.95034],"79":[0,0.68611,0.03194,0,0.83666],"80":[0,0.68611,0.15972,0,0.72309],"81":[0.19444,0.68611,0,0,0.86861],"82":[0,0.68611,0.00421,0,0.87235],"83":[0,0.68611,0.05382,0,0.69271],"84":[0,0.68611,0.15972,0,0.63663],"85":[0,0.68611,0.11424,0,0.80027],"86":[0,0.68611,0.25555,0,0.67778],"87":[0,0.68611,0.15972,0,1.09305],"88":[0,0.68611,0.07778,0,0.94722],"89":[0,0.68611,0.25555,0,0.67458],"90":[0,0.68611,0.06979,0,0.77257],"97":[0,0.44444,0,0,0.63287],"98":[0,0.69444,0,0,0.52083],"99":[0,0.44444,0,0,0.51342],"100":[0,0.69444,0,0,0.60972],"101":[0,0.44444,0,0,0.55361],"102":[0.19444,0.69444,0.11042,0,0.56806],"103":[0.19444,0.44444,0.03704,0,0.5449],"104":[0,0.69444,0,0,0.66759],"105":[0,0.69326,0,0,0.4048],"106":[0.19444,0.69326,0.0622,0,0.47083],"107":[0,0.69444,0.01852,0,0.6037],"108":[0,0.69444,0.0088,0,0.34815],"109":[0,0.44444,0,0,1.0324],"110":[0,0.44444,0,0,0.71296],"111":[0,0.44444,0,0,0.58472],"112":[0.19444,0.44444,0,0,0.60092],"113":[0.19444,0.44444,0.03704,0,0.54213],"114":[0,0.44444,0.03194,0,0.5287],"115":[0,0.44444,0,0,0.53125],"116":[0,0.63492,0,0,0.41528],"117":[0,0.44444,0,0,0.68102],"118":[0,0.44444,0.03704,0,0.56666],"119":[0,0.44444,0.02778,0,0.83148],"120":[0,0.44444,0,0,0.65903],"121":[0.19444,0.44444,0.03704,0,0.59028],"122":[0,0.44444,0.04213,0,0.55509],"915":[0,0.68611,0.15972,0,0.65694],"916":[0,0.68611,0,0,0.95833],"920":[0,0.68611,0.03194,0,0.86722],"923":[0,0.68611,0,0,0.80555],"926":[0,0.68611,0.07458,0,0.84125],"928":[0,0.68611,0.08229,0,0.98229],"931":[0,0.68611,0.05451,0,0.88507],"933":[0,0.68611,0.15972,0,0.67083],"934":[0,0.68611,0,0,0.76666],"936":[0,0.68611,0.11653,0,0.71402],"937":[0,0.68611,0.04835,0,0.8789],"945":[0,0.44444,0,0,0.76064],"946":[0.19444,0.69444,0.03403,0,0.65972],"947":[0.19444,0.44444,0.06389,0,0.59003],"948":[0,0.69444,0.03819,0,0.52222],"949":[0,0.44444,0,0,0.52882],"950":[0.19444,0.69444,0.06215,0,0.50833],"951":[0.19444,0.44444,0.03704,0,0.6],"952":[0,0.69444,0.03194,0,0.5618],"953":[0,0.44444,0,0,0.41204],"954":[0,0.44444,0,0,0.66759],"955":[0,0.69444,0,0,0.67083],"956":[0.19444,0.44444,0,0,0.70787],"957":[0,0.44444,0.06898,0,0.57685],"958":[0.19444,0.69444,0.03021,0,0.50833],"959":[0,0.44444,0,0,0.58472],"960":[0,0.44444,0.03704,0,0.68241],"961":[0.19444,0.44444,0,0,0.6118],"962":[0.09722,0.44444,0.07917,0,0.42361],"963":[0,0.44444,0.03704,0,0.68588],"964":[0,0.44444,0.13472,0,0.52083],"965":[0,0.44444,0.03704,0,0.63055],"966":[0.19444,0.44444,0,0,0.74722],"967":[0.19444,0.44444,0,0,0.71805],"968":[0.19444,0.69444,0.03704,0,0.75833],"969":[0,0.44444,0.03704,0,0.71782],"977":[0,0.69444,0,0,0.69155],"981":[0.19444,0.69444,0,0,0.7125],"982":[0,0.44444,0.03194,0,0.975],"1009":[0.19444,0.44444,0,0,0.6118],"1013":[0,0.44444,0,0,0.48333]},"Math-Italic":{"65":[0,0.68333,0,0.13889,0.75],"66":[0,0.68333,0.05017,0.08334,0.75851],"67":[0,0.68333,0.07153,0.08334,0.71472],"68":[0,0.68333,0.02778,0.05556,0.82792],"69":[0,0.68333,0.05764,0.08334,0.7382],"70":[0,0.68333,0.13889,0.08334,0.64306],"71":[0,0.68333,0,0.08334,0.78625],"72":[0,0.68333,0.08125,0.05556,0.83125],"73":[0,0.68333,0.07847,0.11111,0.43958],"74":[0,0.68333,0.09618,0.16667,0.55451],"75":[0,0.68333,0.07153,0.05556,0.84931],"76":[0,0.68333,0,0.02778,0.68056],"77":[0,0.68333,0.10903,0.08334,0.97014],"78":[0,0.68333,0.10903,0.08334,0.80347],"79":[0,0.68333,0.02778,0.08334,0.76278],"80":[0,0.68333,0.13889,0.08334,0.64201],"81":[0.19444,0.68333,0,0.08334,0.79056],"82":[0,0.68333,0.00773,0.08334,0.75929],"83":[0,0.68333,0.05764,0.08334,0.6132],"84":[0,0.68333,0.13889,0.08334,0.58438],"85":[0,0.68333,0.10903,0.02778,0.68278],"86":[0,0.68333,0.22222,0,0.58333],"87":[0,0.68333,0.13889,0,0.94445],"88":[0,0.68333,0.07847,0.08334,0.82847],"89":[0,0.68333,0.22222,0,0.58056],"90":[0,0.68333,0.07153,0.08334,0.68264],"97":[0,0.43056,0,0,0.52859],"98":[0,0.69444,0,0,0.42917],"99":[0,0.43056,0,0.05556,0.43276],"100":[0,0.69444,0,0.16667,0.52049],"101":[0,0.43056,0,0.05556,0.46563],"102":[0.19444,0.69444,0.10764,0.16667,0.48959],"103":[0.19444,0.43056,0.03588,0.02778,0.47697],"104":[0,0.69444,0,0,0.57616],"105":[0,0.65952,0,0,0.34451],"106":[0.19444,0.65952,0.05724,0,0.41181],"107":[0,0.69444,0.03148,0,0.5206],"108":[0,0.69444,0.01968,0.08334,0.29838],"109":[0,0.43056,0,0,0.87801],"110":[0,0.43056,0,0,0.60023],"111":[0,0.43056,0,0.05556,0.48472],"112":[0.19444,0.43056,0,0.08334,0.50313],"113":[0.19444,0.43056,0.03588,0.08334,0.44641],"114":[0,0.43056,0.02778,0.05556,0.45116],"115":[0,0.43056,0,0.05556,0.46875],"116":[0,0.61508,0,0.08334,0.36111],"117":[0,0.43056,0,0.02778,0.57246],"118":[0,0.43056,0.03588,0.02778,0.48472],"119":[0,0.43056,0.02691,0.08334,0.71592],"120":[0,0.43056,0,0.02778,0.57153],"121":[0.19444,0.43056,0.03588,0.05556,0.49028],"122":[0,0.43056,0.04398,0.05556,0.46505],"915":[0,0.68333,0.13889,0.08334,0.61528],"916":[0,0.68333,0,0.16667,0.83334],"920":[0,0.68333,0.02778,0.08334,0.76278],"923":[0,0.68333,0,0.16667,0.69445],"926":[0,0.68333,0.07569,0.08334,0.74236],"928":[0,0.68333,0.08125,0.05556,0.83125],"931":[0,0.68333,0.05764,0.08334,0.77986],"933":[0,0.68333,0.13889,0.05556,0.58333],"934":[0,0.68333,0,0.08334,0.66667],"936":[0,0.68333,0.11,0.05556,0.61222],"937":[0,0.68333,0.05017,0.08334,0.7724],"945":[0,0.43056,0.0037,0.02778,0.6397],"946":[0.19444,0.69444,0.05278,0.08334,0.56563],"947":[0.19444,0.43056,0.05556,0,0.51773],"948":[0,0.69444,0.03785,0.05556,0.44444],"949":[0,0.43056,0,0.08334,0.46632],"950":[0.19444,0.69444,0.07378,0.08334,0.4375],"951":[0.19444,0.43056,0.03588,0.05556,0.49653],"952":[0,0.69444,0.02778,0.08334,0.46944],"953":[0,0.43056,0,0.05556,0.35394],"954":[0,0.43056,0,0,0.57616],"955":[0,0.69444,0,0,0.58334],"956":[0.19444,0.43056,0,0.02778,0.60255],"957":[0,0.43056,0.06366,0.02778,0.49398],"958":[0.19444,0.69444,0.04601,0.11111,0.4375],"959":[0,0.43056,0,0.05556,0.48472],"960":[0,0.43056,0.03588,0,0.57003],"961":[0.19444,0.43056,0,0.08334,0.51702],"962":[0.09722,0.43056,0.07986,0.08334,0.36285],"963":[0,0.43056,0.03588,0,0.57141],"964":[0,0.43056,0.1132,0.02778,0.43715],"965":[0,0.43056,0.03588,0.02778,0.54028],"966":[0.19444,0.43056,0,0.08334,0.65417],"967":[0.19444,0.43056,0,0.05556,0.62569],"968":[0.19444,0.69444,0.03588,0.11111,0.65139],"969":[0,0.43056,0.03588,0,0.62245],"977":[0,0.69444,0,0.08334,0.59144],"981":[0.19444,0.69444,0,0.08334,0.59583],"982":[0,0.43056,0.02778,0,0.82813],"1009":[0.19444,0.43056,0,0.08334,0.51702],"1013":[0,0.43056,0,0.05556,0.4059]},"Math-Regular":{"65":[0,0.68333,0,0.13889,0.75],"66":[0,0.68333,0.05017,0.08334,0.75851],"67":[0,0.68333,0.07153,0.08334,0.71472],"68":[0,0.68333,0.02778,0.05556,0.82792],"69":[0,0.68333,0.05764,0.08334,0.7382],"70":[0,0.68333,0.13889,0.08334,0.64306],"71":[0,0.68333,0,0.08334,0.78625],"72":[0,0.68333,0.08125,0.05556,0.83125],"73":[0,0.68333,0.07847,0.11111,0.43958],"74":[0,0.68333,0.09618,0.16667,0.55451],"75":[0,0.68333,0.07153,0.05556,0.84931],"76":[0,0.68333,0,0.02778,0.68056],"77":[0,0.68333,0.10903,0.08334,0.97014],"78":[0,0.68333,0.10903,0.08334,0.80347],"79":[0,0.68333,0.02778,0.08334,0.76278],"80":[0,0.68333,0.13889,0.08334,0.64201],"81":[0.19444,0.68333,0,0.08334,0.79056],"82":[0,0.68333,0.00773,0.08334,0.75929],"83":[0,0.68333,0.05764,0.08334,0.6132],"84":[0,0.68333,0.13889,0.08334,0.58438],"85":[0,0.68333,0.10903,0.02778,0.68278],"86":[0,0.68333,0.22222,0,0.58333],"87":[0,0.68333,0.13889,0,0.94445],"88":[0,0.68333,0.07847,0.08334,0.82847],"89":[0,0.68333,0.22222,0,0.58056],"90":[0,0.68333,0.07153,0.08334,0.68264],"97":[0,0.43056,0,0,0.52859],"98":[0,0.69444,0,0,0.42917],"99":[0,0.43056,0,0.05556,0.43276],"100":[0,0.69444,0,0.16667,0.52049],"101":[0,0.43056,0,0.05556,0.46563],"102":[0.19444,0.69444,0.10764,0.16667,0.48959],"103":[0.19444,0.43056,0.03588,0.02778,0.47697],"104":[0,0.69444,0,0,0.57616],"105":[0,0.65952,0,0,0.34451],"106":[0.19444,0.65952,0.05724,0,0.41181],"107":[0,0.69444,0.03148,0,0.5206],"108":[0,0.69444,0.01968,0.08334,0.29838],"109":[0,0.43056,0,0,0.87801],"110":[0,0.43056,0,0,0.60023],"111":[0,0.43056,0,0.05556,0.48472],"112":[0.19444,0.43056,0,0.08334,0.50313],"113":[0.19444,0.43056,0.03588,0.08334,0.44641],"114":[0,0.43056,0.02778,0.05556,0.45116],"115":[0,0.43056,0,0.05556,0.46875],"116":[0,0.61508,0,0.08334,0.36111],"117":[0,0.43056,0,0.02778,0.57246],"118":[0,0.43056,0.03588,0.02778,0.48472],"119":[0,0.43056,0.02691,0.08334,0.71592],"120":[0,0.43056,0,0.02778,0.57153],"121":[0.19444,0.43056,0.03588,0.05556,0.49028],"122":[0,0.43056,0.04398,0.05556,0.46505],"915":[0,0.68333,0.13889,0.08334,0.61528],"916":[0,0.68333,0,0.16667,0.83334],"920":[0,0.68333,0.02778,0.08334,0.76278],"923":[0,0.68333,0,0.16667,0.69445],"926":[0,0.68333,0.07569,0.08334,0.74236],"928":[0,0.68333,0.08125,0.05556,0.83125],"931":[0,0.68333,0.05764,0.08334,0.77986],"933":[0,0.68333,0.13889,0.05556,0.58333],"934":[0,0.68333,0,0.08334,0.66667],"936":[0,0.68333,0.11,0.05556,0.61222],"937":[0,0.68333,0.05017,0.08334,0.7724],"945":[0,0.43056,0.0037,0.02778,0.6397],"946":[0.19444,0.69444,0.05278,0.08334,0.56563],"947":[0.19444,0.43056,0.05556,0,0.51773],"948":[0,0.69444,0.03785,0.05556,0.44444],"949":[0,0.43056,0,0.08334,0.46632],"950":[0.19444,0.69444,0.07378,0.08334,0.4375],"951":[0.19444,0.43056,0.03588,0.05556,0.49653],"952":[0,0.69444,0.02778,0.08334,0.46944],"953":[0,0.43056,0,0.05556,0.35394],"954":[0,0.43056,0,0,0.57616],"955":[0,0.69444,0,0,0.58334],"956":[0.19444,0.43056,0,0.02778,0.60255],"957":[0,0.43056,0.06366,0.02778,0.49398],"958":[0.19444,0.69444,0.04601,0.11111,0.4375],"959":[0,0.43056,0,0.05556,0.48472],"960":[0,0.43056,0.03588,0,0.57003],"961":[0.19444,0.43056,0,0.08334,0.51702],"962":[0.09722,0.43056,0.07986,0.08334,0.36285],"963":[0,0.43056,0.03588,0,0.57141],"964":[0,0.43056,0.1132,0.02778,0.43715],"965":[0,0.43056,0.03588,0.02778,0.54028],"966":[0.19444,0.43056,0,0.08334,0.65417],"967":[0.19444,0.43056,0,0.05556,0.62569],"968":[0.19444,0.69444,0.03588,0.11111,0.65139],"969":[0,0.43056,0.03588,0,0.62245],"977":[0,0.69444,0,0.08334,0.59144],"981":[0.19444,0.69444,0,0.08334,0.59583],"982":[0,0.43056,0.02778,0,0.82813],"1009":[0.19444,0.43056,0,0.08334,0.51702],"1013":[0,0.43056,0,0.05556,0.4059]},"SansSerif-Bold":{"33":[0,0.69444,0,0,0.36667],"34":[0,0.69444,0,0,0.55834],"35":[0.19444,0.69444,0,0,0.91667],"36":[0.05556,0.75,0,0,0.55],"37":[0.05556,0.75,0,0,1.02912],"38":[0,0.69444,0,0,0.83056],"39":[0,0.69444,0,0,0.30556],"40":[0.25,0.75,0,0,0.42778],"41":[0.25,0.75,0,0,0.42778],"42":[0,0.75,0,0,0.55],"43":[0.11667,0.61667,0,0,0.85556],"44":[0.10556,0.13056,0,0,0.30556],"45":[0,0.45833,0,0,0.36667],"46":[0,0.13056,0,0,0.30556],"47":[0.25,0.75,0,0,0.55],"48":[0,0.69444,0,0,0.55],"49":[0,0.69444,0,0,0.55],"50":[0,0.69444,0,0,0.55],"51":[0,0.69444,0,0,0.55],"52":[0,0.69444,0,0,0.55],"53":[0,0.69444,0,0,0.55],"54":[0,0.69444,0,0,0.55],"55":[0,0.69444,0,0,0.55],"56":[0,0.69444,0,0,0.55],"57":[0,0.69444,0,0,0.55],"58":[0,0.45833,0,0,0.30556],"59":[0.10556,0.45833,0,0,0.30556],"61":[-0.09375,0.40625,0,0,0.85556],"63":[0,0.69444,0,0,0.51945],"64":[0,0.69444,0,0,0.73334],"65":[0,0.69444,0,0,0.73334],"66":[0,0.69444,0,0,0.73334],"67":[0,0.69444,0,0,0.70278],"68":[0,0.69444,0,0,0.79445],"69":[0,0.69444,0,0,0.64167],"70":[0,0.69444,0,0,0.61111],"71":[0,0.69444,0,0,0.73334],"72":[0,0.69444,0,0,0.79445],"73":[0,0.69444,0,0,0.33056],"74":[0,0.69444,0,0,0.51945],"75":[0,0.69444,0,0,0.76389],"76":[0,0.69444,0,0,0.58056],"77":[0,0.69444,0,0,0.97778],"78":[0,0.69444,0,0,0.79445],"79":[0,0.69444,0,0,0.79445],"80":[0,0.69444,0,0,0.70278],"81":[0.10556,0.69444,0,0,0.79445],"82":[0,0.69444,0,0,0.70278],"83":[0,0.69444,0,0,0.61111],"84":[0,0.69444,0,0,0.73334],"85":[0,0.69444,0,0,0.76389],"86":[0,0.69444,0.01528,0,0.73334],"87":[0,0.69444,0.01528,0,1.03889],"88":[0,0.69444,0,0,0.73334],"89":[0,0.69444,0.0275,0,0.73334],"90":[0,0.69444,0,0,0.67223],"91":[0.25,0.75,0,0,0.34306],"93":[0.25,0.75,0,0,0.34306],"94":[0,0.69444,0,0,0.55],"95":[0.35,0.10833,0.03056,0,0.55],"97":[0,0.45833,0,0,0.525],"98":[0,0.69444,0,0,0.56111],"99":[0,0.45833,0,0,0.48889],"100":[0,0.69444,0,0,0.56111],"101":[0,0.45833,0,0,0.51111],"102":[0,0.69444,0.07639,0,0.33611],"103":[0.19444,0.45833,0.01528,0,0.55],"104":[0,0.69444,0,0,0.56111],"105":[0,0.69444,0,0,0.25556],"106":[0.19444,0.69444,0,0,0.28611],"107":[0,0.69444,0,0,0.53056],"108":[0,0.69444,0,0,0.25556],"109":[0,0.45833,0,0,0.86667],"110":[0,0.45833,0,0,0.56111],"111":[0,0.45833,0,0,0.55],"112":[0.19444,0.45833,0,0,0.56111],"113":[0.19444,0.45833,0,0,0.56111],"114":[0,0.45833,0.01528,0,0.37222],"115":[0,0.45833,0,0,0.42167],"116":[0,0.58929,0,0,0.40417],"117":[0,0.45833,0,0,0.56111],"118":[0,0.45833,0.01528,0,0.5],"119":[0,0.45833,0.01528,0,0.74445],"120":[0,0.45833,0,0,0.5],"121":[0.19444,0.45833,0.01528,0,0.5],"122":[0,0.45833,0,0,0.47639],"126":[0.35,0.34444,0,0,0.55],"168":[0,0.69444,0,0,0.55],"176":[0,0.69444,0,0,0.73334],"180":[0,0.69444,0,0,0.55],"184":[0.17014,0,0,0,0.48889],"305":[0,0.45833,0,0,0.25556],"567":[0.19444,0.45833,0,0,0.28611],"710":[0,0.69444,0,0,0.55],"711":[0,0.63542,0,0,0.55],"713":[0,0.63778,0,0,0.55],"728":[0,0.69444,0,0,0.55],"729":[0,0.69444,0,0,0.30556],"730":[0,0.69444,0,0,0.73334],"732":[0,0.69444,0,0,0.55],"733":[0,0.69444,0,0,0.55],"915":[0,0.69444,0,0,0.58056],"916":[0,0.69444,0,0,0.91667],"920":[0,0.69444,0,0,0.85556],"923":[0,0.69444,0,0,0.67223],"926":[0,0.69444,0,0,0.73334],"928":[0,0.69444,0,0,0.79445],"931":[0,0.69444,0,0,0.79445],"933":[0,0.69444,0,0,0.85556],"934":[0,0.69444,0,0,0.79445],"936":[0,0.69444,0,0,0.85556],"937":[0,0.69444,0,0,0.79445],"8211":[0,0.45833,0.03056,0,0.55],"8212":[0,0.45833,0.03056,0,1.10001],"8216":[0,0.69444,0,0,0.30556],"8217":[0,0.69444,0,0,0.30556],"8220":[0,0.69444,0,0,0.55834],"8221":[0,0.69444,0,0,0.55834]},"SansSerif-Italic":{"33":[0,0.69444,0.05733,0,0.31945],"34":[0,0.69444,0.00316,0,0.5],"35":[0.19444,0.69444,0.05087,0,0.83334],"36":[0.05556,0.75,0.11156,0,0.5],"37":[0.05556,0.75,0.03126,0,0.83334],"38":[0,0.69444,0.03058,0,0.75834],"39":[0,0.69444,0.07816,0,0.27778],"40":[0.25,0.75,0.13164,0,0.38889],"41":[0.25,0.75,0.02536,0,0.38889],"42":[0,0.75,0.11775,0,0.5],"43":[0.08333,0.58333,0.02536,0,0.77778],"44":[0.125,0.08333,0,0,0.27778],"45":[0,0.44444,0.01946,0,0.33333],"46":[0,0.08333,0,0,0.27778],"47":[0.25,0.75,0.13164,0,0.5],"48":[0,0.65556,0.11156,0,0.5],"49":[0,0.65556,0.11156,0,0.5],"50":[0,0.65556,0.11156,0,0.5],"51":[0,0.65556,0.11156,0,0.5],"52":[0,0.65556,0.11156,0,0.5],"53":[0,0.65556,0.11156,0,0.5],"54":[0,0.65556,0.11156,0,0.5],"55":[0,0.65556,0.11156,0,0.5],"56":[0,0.65556,0.11156,0,0.5],"57":[0,0.65556,0.11156,0,0.5],"58":[0,0.44444,0.02502,0,0.27778],"59":[0.125,0.44444,0.02502,0,0.27778],"61":[-0.13,0.37,0.05087,0,0.77778],"63":[0,0.69444,0.11809,0,0.47222],"64":[0,0.69444,0.07555,0,0.66667],"65":[0,0.69444,0,0,0.66667],"66":[0,0.69444,0.08293,0,0.66667],"67":[0,0.69444,0.11983,0,0.63889],"68":[0,0.69444,0.07555,0,0.72223],"69":[0,0.69444,0.11983,0,0.59722],"70":[0,0.69444,0.13372,0,0.56945],"71":[0,0.69444,0.11983,0,0.66667],"72":[0,0.69444,0.08094,0,0.70834],"73":[0,0.69444,0.13372,0,0.27778],"74":[0,0.69444,0.08094,0,0.47222],"75":[0,0.69444,0.11983,0,0.69445],"76":[0,0.69444,0,0,0.54167],"77":[0,0.69444,0.08094,0,0.875],"78":[0,0.69444,0.08094,0,0.70834],"79":[0,0.69444,0.07555,0,0.73611],"80":[0,0.69444,0.08293,0,0.63889],"81":[0.125,0.69444,0.07555,0,0.73611],"82":[0,0.69444,0.08293,0,0.64584],"83":[0,0.69444,0.09205,0,0.55556],"84":[0,0.69444,0.13372,0,0.68056],"85":[0,0.69444,0.08094,0,0.6875],"86":[0,0.69444,0.1615,0,0.66667],"87":[0,0.69444,0.1615,0,0.94445],"88":[0,0.69444,0.13372,0,0.66667],"89":[0,0.69444,0.17261,0,0.66667],"90":[0,0.69444,0.11983,0,0.61111],"91":[0.25,0.75,0.15942,0,0.28889],"93":[0.25,0.75,0.08719,0,0.28889],"94":[0,0.69444,0.0799,0,0.5],"95":[0.35,0.09444,0.08616,0,0.5],"97":[0,0.44444,0.00981,0,0.48056],"98":[0,0.69444,0.03057,0,0.51667],"99":[0,0.44444,0.08336,0,0.44445],"100":[0,0.69444,0.09483,0,0.51667],"101":[0,0.44444,0.06778,0,0.44445],"102":[0,0.69444,0.21705,0,0.30556],"103":[0.19444,0.44444,0.10836,0,0.5],"104":[0,0.69444,0.01778,0,0.51667],"105":[0,0.67937,0.09718,0,0.23889],"106":[0.19444,0.67937,0.09162,0,0.26667],"107":[0,0.69444,0.08336,0,0.48889],"108":[0,0.69444,0.09483,0,0.23889],"109":[0,0.44444,0.01778,0,0.79445],"110":[0,0.44444,0.01778,0,0.51667],"111":[0,0.44444,0.06613,0,0.5],"112":[0.19444,0.44444,0.0389,0,0.51667],"113":[0.19444,0.44444,0.04169,0,0.51667],"114":[0,0.44444,0.10836,0,0.34167],"115":[0,0.44444,0.0778,0,0.38333],"116":[0,0.57143,0.07225,0,0.36111],"117":[0,0.44444,0.04169,0,0.51667],"118":[0,0.44444,0.10836,0,0.46111],"119":[0,0.44444,0.10836,0,0.68334],"120":[0,0.44444,0.09169,0,0.46111],"121":[0.19444,0.44444,0.10836,0,0.46111],"122":[0,0.44444,0.08752,0,0.43472],"126":[0.35,0.32659,0.08826,0,0.5],"168":[0,0.67937,0.06385,0,0.5],"176":[0,0.69444,0,0,0.73752],"184":[0.17014,0,0,0,0.44445],"305":[0,0.44444,0.04169,0,0.23889],"567":[0.19444,0.44444,0.04169,0,0.26667],"710":[0,0.69444,0.0799,0,0.5],"711":[0,0.63194,0.08432,0,0.5],"713":[0,0.60889,0.08776,0,0.5],"714":[0,0.69444,0.09205,0,0.5],"715":[0,0.69444,0,0,0.5],"728":[0,0.69444,0.09483,0,0.5],"729":[0,0.67937,0.07774,0,0.27778],"730":[0,0.69444,0,0,0.73752],"732":[0,0.67659,0.08826,0,0.5],"733":[0,0.69444,0.09205,0,0.5],"915":[0,0.69444,0.13372,0,0.54167],"916":[0,0.69444,0,0,0.83334],"920":[0,0.69444,0.07555,0,0.77778],"923":[0,0.69444,0,0,0.61111],"926":[0,0.69444,0.12816,0,0.66667],"928":[0,0.69444,0.08094,0,0.70834],"931":[0,0.69444,0.11983,0,0.72222],"933":[0,0.69444,0.09031,0,0.77778],"934":[0,0.69444,0.04603,0,0.72222],"936":[0,0.69444,0.09031,0,0.77778],"937":[0,0.69444,0.08293,0,0.72222],"8211":[0,0.44444,0.08616,0,0.5],"8212":[0,0.44444,0.08616,0,1.0],"8216":[0,0.69444,0.07816,0,0.27778],"8217":[0,0.69444,0.07816,0,0.27778],"8220":[0,0.69444,0.14205,0,0.5],"8221":[0,0.69444,0.00316,0,0.5]},"SansSerif-Regular":{"33":[0,0.69444,0,0,0.31945],"34":[0,0.69444,0,0,0.5],"35":[0.19444,0.69444,0,0,0.83334],"36":[0.05556,0.75,0,0,0.5],"37":[0.05556,0.75,0,0,0.83334],"38":[0,0.69444,0,0,0.75834],"39":[0,0.69444,0,0,0.27778],"40":[0.25,0.75,0,0,0.38889],"41":[0.25,0.75,0,0,0.38889],"42":[0,0.75,0,0,0.5],"43":[0.08333,0.58333,0,0,0.77778],"44":[0.125,0.08333,0,0,0.27778],"45":[0,0.44444,0,0,0.33333],"46":[0,0.08333,0,0,0.27778],"47":[0.25,0.75,0,0,0.5],"48":[0,0.65556,0,0,0.5],"49":[0,0.65556,0,0,0.5],"50":[0,0.65556,0,0,0.5],"51":[0,0.65556,0,0,0.5],"52":[0,0.65556,0,0,0.5],"53":[0,0.65556,0,0,0.5],"54":[0,0.65556,0,0,0.5],"55":[0,0.65556,0,0,0.5],"56":[0,0.65556,0,0,0.5],"57":[0,0.65556,0,0,0.5],"58":[0,0.44444,0,0,0.27778],"59":[0.125,0.44444,0,0,0.27778],"61":[-0.13,0.37,0,0,0.77778],"63":[0,0.69444,0,0,0.47222],"64":[0,0.69444,0,0,0.66667],"65":[0,0.69444,0,0,0.66667],"66":[0,0.69444,0,0,0.66667],"67":[0,0.69444,0,0,0.63889],"68":[0,0.69444,0,0,0.72223],"69":[0,0.69444,0,0,0.59722],"70":[0,0.69444,0,0,0.56945],"71":[0,0.69444,0,0,0.66667],"72":[0,0.69444,0,0,0.70834],"73":[0,0.69444,0,0,0.27778],"74":[0,0.69444,0,0,0.47222],"75":[0,0.69444,0,0,0.69445],"76":[0,0.69444,0,0,0.54167],"77":[0,0.69444,0,0,0.875],"78":[0,0.69444,0,0,0.70834],"79":[0,0.69444,0,0,0.73611],"80":[0,0.69444,0,0,0.63889],"81":[0.125,0.69444,0,0,0.73611],"82":[0,0.69444,0,0,0.64584],"83":[0,0.69444,0,0,0.55556],"84":[0,0.69444,0,0,0.68056],"85":[0,0.69444,0,0,0.6875],"86":[0,0.69444,0.01389,0,0.66667],"87":[0,0.69444,0.01389,0,0.94445],"88":[0,0.69444,0,0,0.66667],"89":[0,0.69444,0.025,0,0.66667],"90":[0,0.69444,0,0,0.61111],"91":[0.25,0.75,0,0,0.28889],"93":[0.25,0.75,0,0,0.28889],"94":[0,0.69444,0,0,0.5],"95":[0.35,0.09444,0.02778,0,0.5],"97":[0,0.44444,0,0,0.48056],"98":[0,0.69444,0,0,0.51667],"99":[0,0.44444,0,0,0.44445],"100":[0,0.69444,0,0,0.51667],"101":[0,0.44444,0,0,0.44445],"102":[0,0.69444,0.06944,0,0.30556],"103":[0.19444,0.44444,0.01389,0,0.5],"104":[0,0.69444,0,0,0.51667],"105":[0,0.67937,0,0,0.23889],"106":[0.19444,0.67937,0,0,0.26667],"107":[0,0.69444,0,0,0.48889],"108":[0,0.69444,0,0,0.23889],"109":[0,0.44444,0,0,0.79445],"110":[0,0.44444,0,0,0.51667],"111":[0,0.44444,0,0,0.5],"112":[0.19444,0.44444,0,0,0.51667],"113":[0.19444,0.44444,0,0,0.51667],"114":[0,0.44444,0.01389,0,0.34167],"115":[0,0.44444,0,0,0.38333],"116":[0,0.57143,0,0,0.36111],"117":[0,0.44444,0,0,0.51667],"118":[0,0.44444,0.01389,0,0.46111],"119":[0,0.44444,0.01389,0,0.68334],"120":[0,0.44444,0,0,0.46111],"121":[0.19444,0.44444,0.01389,0,0.46111],"122":[0,0.44444,0,0,0.43472],"126":[0.35,0.32659,0,0,0.5],"168":[0,0.67937,0,0,0.5],"176":[0,0.69444,0,0,0.66667],"184":[0.17014,0,0,0,0.44445],"305":[0,0.44444,0,0,0.23889],"567":[0.19444,0.44444,0,0,0.26667],"710":[0,0.69444,0,0,0.5],"711":[0,0.63194,0,0,0.5],"713":[0,0.60889,0,0,0.5],"714":[0,0.69444,0,0,0.5],"715":[0,0.69444,0,0,0.5],"728":[0,0.69444,0,0,0.5],"729":[0,0.67937,0,0,0.27778],"730":[0,0.69444,0,0,0.66667],"732":[0,0.67659,0,0,0.5],"733":[0,0.69444,0,0,0.5],"915":[0,0.69444,0,0,0.54167],"916":[0,0.69444,0,0,0.83334],"920":[0,0.69444,0,0,0.77778],"923":[0,0.69444,0,0,0.61111],"926":[0,0.69444,0,0,0.66667],"928":[0,0.69444,0,0,0.70834],"931":[0,0.69444,0,0,0.72222],"933":[0,0.69444,0,0,0.77778],"934":[0,0.69444,0,0,0.72222],"936":[0,0.69444,0,0,0.77778],"937":[0,0.69444,0,0,0.72222],"8211":[0,0.44444,0.02778,0,0.5],"8212":[0,0.44444,0.02778,0,1.0],"8216":[0,0.69444,0,0,0.27778],"8217":[0,0.69444,0,0,0.27778],"8220":[0,0.69444,0,0,0.5],"8221":[0,0.69444,0,0,0.5]},"Script-Regular":{"65":[0,0.7,0.22925,0,0.80253],"66":[0,0.7,0.04087,0,0.90757],"67":[0,0.7,0.1689,0,0.66619],"68":[0,0.7,0.09371,0,0.77443],"69":[0,0.7,0.18583,0,0.56162],"70":[0,0.7,0.13634,0,0.89544],"71":[0,0.7,0.17322,0,0.60961],"72":[0,0.7,0.29694,0,0.96919],"73":[0,0.7,0.19189,0,0.80907],"74":[0.27778,0.7,0.19189,0,1.05159],"75":[0,0.7,0.31259,0,0.91364],"76":[0,0.7,0.19189,0,0.87373],"77":[0,0.7,0.15981,0,1.08031],"78":[0,0.7,0.3525,0,0.9015],"79":[0,0.7,0.08078,0,0.73787],"80":[0,0.7,0.08078,0,1.01262],"81":[0,0.7,0.03305,0,0.88282],"82":[0,0.7,0.06259,0,0.85],"83":[0,0.7,0.19189,0,0.86767],"84":[0,0.7,0.29087,0,0.74697],"85":[0,0.7,0.25815,0,0.79996],"86":[0,0.7,0.27523,0,0.62204],"87":[0,0.7,0.27523,0,0.80532],"88":[0,0.7,0.26006,0,0.94445],"89":[0,0.7,0.2939,0,0.70961],"90":[0,0.7,0.24037,0,0.8212]},"Size1-Regular":{"40":[0.35001,0.85,0,0,0.45834],"41":[0.35001,0.85,0,0,0.45834],"47":[0.35001,0.85,0,0,0.57778],"91":[0.35001,0.85,0,0,0.41667],"92":[0.35001,0.85,0,0,0.57778],"93":[0.35001,0.85,0,0,0.41667],"123":[0.35001,0.85,0,0,0.58334],"125":[0.35001,0.85,0,0,0.58334],"710":[0,0.72222,0,0,0.55556],"732":[0,0.72222,0,0,0.55556],"770":[0,0.72222,0,0,0.55556],"771":[0,0.72222,0,0,0.55556],"8214":[-0.00099,0.601,0,0,0.77778],"8593":[1e-05,0.6,0,0,0.66667],"8595":[1e-05,0.6,0,0,0.66667],"8657":[1e-05,0.6,0,0,0.77778],"8659":[1e-05,0.6,0,0,0.77778],"8719":[0.25001,0.75,0,0,0.94445],"8720":[0.25001,0.75,0,0,0.94445],"8721":[0.25001,0.75,0,0,1.05556],"8730":[0.35001,0.85,0,0,1.0],"8739":[-0.00599,0.606,0,0,0.33333],"8741":[-0.00599,0.606,0,0,0.55556],"8747":[0.30612,0.805,0.19445,0,0.47222],"8748":[0.306,0.805,0.19445,0,0.47222],"8749":[0.306,0.805,0.19445,0,0.47222],"8750":[0.30612,0.805,0.19445,0,0.47222],"8896":[0.25001,0.75,0,0,0.83334],"8897":[0.25001,0.75,0,0,0.83334],"8898":[0.25001,0.75,0,0,0.83334],"8899":[0.25001,0.75,0,0,0.83334],"8968":[0.35001,0.85,0,0,0.47222],"8969":[0.35001,0.85,0,0,0.47222],"8970":[0.35001,0.85,0,0,0.47222],"8971":[0.35001,0.85,0,0,0.47222],"9168":[-0.00099,0.601,0,0,0.66667],"10216":[0.35001,0.85,0,0,0.47222],"10217":[0.35001,0.85,0,0,0.47222],"10752":[0.25001,0.75,0,0,1.11111],"10753":[0.25001,0.75,0,0,1.11111],"10754":[0.25001,0.75,0,0,1.11111],"10756":[0.25001,0.75,0,0,0.83334],"10758":[0.25001,0.75,0,0,0.83334]},"Size2-Regular":{"40":[0.65002,1.15,0,0,0.59722],"41":[0.65002,1.15,0,0,0.59722],"47":[0.65002,1.15,0,0,0.81111],"91":[0.65002,1.15,0,0,0.47222],"92":[0.65002,1.15,0,0,0.81111],"93":[0.65002,1.15,0,0,0.47222],"123":[0.65002,1.15,0,0,0.66667],"125":[0.65002,1.15,0,0,0.66667],"710":[0,0.75,0,0,1.0],"732":[0,0.75,0,0,1.0],"770":[0,0.75,0,0,1.0],"771":[0,0.75,0,0,1.0],"8719":[0.55001,1.05,0,0,1.27778],"8720":[0.55001,1.05,0,0,1.27778],"8721":[0.55001,1.05,0,0,1.44445],"8730":[0.65002,1.15,0,0,1.0],"8747":[0.86225,1.36,0.44445,0,0.55556],"8748":[0.862,1.36,0.44445,0,0.55556],"8749":[0.862,1.36,0.44445,0,0.55556],"8750":[0.86225,1.36,0.44445,0,0.55556],"8896":[0.55001,1.05,0,0,1.11111],"8897":[0.55001,1.05,0,0,1.11111],"8898":[0.55001,1.05,0,0,1.11111],"8899":[0.55001,1.05,0,0,1.11111],"8968":[0.65002,1.15,0,0,0.52778],"8969":[0.65002,1.15,0,0,0.52778],"8970":[0.65002,1.15,0,0,0.52778],"8971":[0.65002,1.15,0,0,0.52778],"10216":[0.65002,1.15,0,0,0.61111],"10217":[0.65002,1.15,0,0,0.61111],"10752":[0.55001,1.05,0,0,1.51112],"10753":[0.55001,1.05,0,0,1.51112],"10754":[0.55001,1.05,0,0,1.51112],"10756":[0.55001,1.05,0,0,1.11111],"10758":[0.55001,1.05,0,0,1.11111]},"Size3-Regular":{"40":[0.95003,1.45,0,0,0.73611],"41":[0.95003,1.45,0,0,0.73611],"47":[0.95003,1.45,0,0,1.04445],"91":[0.95003,1.45,0,0,0.52778],"92":[0.95003,1.45,0,0,1.04445],"93":[0.95003,1.45,0,0,0.52778],"123":[0.95003,1.45,0,0,0.75],"125":[0.95003,1.45,0,0,0.75],"710":[0,0.75,0,0,1.44445],"732":[0,0.75,0,0,1.44445],"770":[0,0.75,0,0,1.44445],"771":[0,0.75,0,0,1.44445],"8730":[0.95003,1.45,0,0,1.0],"8968":[0.95003,1.45,0,0,0.58334],"8969":[0.95003,1.45,0,0,0.58334],"8970":[0.95003,1.45,0,0,0.58334],"8971":[0.95003,1.45,0,0,0.58334],"10216":[0.95003,1.45,0,0,0.75],"10217":[0.95003,1.45,0,0,0.75]},"Size4-Regular":{"40":[1.25003,1.75,0,0,0.79167],"41":[1.25003,1.75,0,0,0.79167],"47":[1.25003,1.75,0,0,1.27778],"91":[1.25003,1.75,0,0,0.58334],"92":[1.25003,1.75,0,0,1.27778],"93":[1.25003,1.75,0,0,0.58334],"123":[1.25003,1.75,0,0,0.80556],"125":[1.25003,1.75,0,0,0.80556],"710":[0,0.825,0,0,1.8889],"732":[0,0.825,0,0,1.8889],"770":[0,0.825,0,0,1.8889],"771":[0,0.825,0,0,1.8889],"8730":[1.25003,1.75,0,0,1.0],"8968":[1.25003,1.75,0,0,0.63889],"8969":[1.25003,1.75,0,0,0.63889],"8970":[1.25003,1.75,0,0,0.63889],"8971":[1.25003,1.75,0,0,0.63889],"9115":[0.64502,1.155,0,0,0.875],"9116":[1e-05,0.6,0,0,0.875],"9117":[0.64502,1.155,0,0,0.875],"9118":[0.64502,1.155,0,0,0.875],"9119":[1e-05,0.6,0,0,0.875],"9120":[0.64502,1.155,0,0,0.875],"9121":[0.64502,1.155,0,0,0.66667],"9122":[-0.00099,0.601,0,0,0.66667],"9123":[0.64502,1.155,0,0,0.66667],"9124":[0.64502,1.155,0,0,0.66667],"9125":[-0.00099,0.601,0,0,0.66667],"9126":[0.64502,1.155,0,0,0.66667],"9127":[1e-05,0.9,0,0,0.88889],"9128":[0.65002,1.15,0,0,0.88889],"9129":[0.90001,0,0,0,0.88889],"9130":[0,0.3,0,0,0.88889],"9131":[1e-05,0.9,0,0,0.88889],"9132":[0.65002,1.15,0,0,0.88889],"9133":[0.90001,0,0,0,0.88889],"9143":[0.88502,0.915,0,0,1.05556],"10216":[1.25003,1.75,0,0,0.80556],"10217":[1.25003,1.75,0,0,0.80556],"57344":[-0.00499,0.605,0,0,1.05556],"57345":[-0.00499,0.605,0,0,1.05556],"57680":[0,0.12,0,0,0.45],"57681":[0,0.12,0,0,0.45],"57682":[0,0.12,0,0,0.45],"57683":[0,0.12,0,0,0.45]},"Typewriter-Regular":{"32":[0,0,0,0,0.525],"33":[0,0.61111,0,0,0.525],"34":[0,0.61111,0,0,0.525],"35":[0,0.61111,0,0,0.525],"36":[0.08333,0.69444,0,0,0.525],"37":[0.08333,0.69444,0,0,0.525],"38":[0,0.61111,0,0,0.525],"39":[0,0.61111,0,0,0.525],"40":[0.08333,0.69444,0,0,0.525],"41":[0.08333,0.69444,0,0,0.525],"42":[0,0.52083,0,0,0.525],"43":[-0.08056,0.53055,0,0,0.525],"44":[0.13889,0.125,0,0,0.525],"45":[-0.08056,0.53055,0,0,0.525],"46":[0,0.125,0,0,0.525],"47":[0.08333,0.69444,0,0,0.525],"48":[0,0.61111,0,0,0.525],"49":[0,0.61111,0,0,0.525],"50":[0,0.61111,0,0,0.525],"51":[0,0.61111,0,0,0.525],"52":[0,0.61111,0,0,0.525],"53":[0,0.61111,0,0,0.525],"54":[0,0.61111,0,0,0.525],"55":[0,0.61111,0,0,0.525],"56":[0,0.61111,0,0,0.525],"57":[0,0.61111,0,0,0.525],"58":[0,0.43056,0,0,0.525],"59":[0.13889,0.43056,0,0,0.525],"60":[-0.05556,0.55556,0,0,0.525],"61":[-0.19549,0.41562,0,0,0.525],"62":[-0.05556,0.55556,0,0,0.525],"63":[0,0.61111,0,0,0.525],"64":[0,0.61111,0,0,0.525],"65":[0,0.61111,0,0,0.525],"66":[0,0.61111,0,0,0.525],"67":[0,0.61111,0,0,0.525],"68":[0,0.61111,0,0,0.525],"69":[0,0.61111,0,0,0.525],"70":[0,0.61111,0,0,0.525],"71":[0,0.61111,0,0,0.525],"72":[0,0.61111,0,0,0.525],"73":[0,0.61111,0,0,0.525],"74":[0,0.61111,0,0,0.525],"75":[0,0.61111,0,0,0.525],"76":[0,0.61111,0,0,0.525],"77":[0,0.61111,0,0,0.525],"78":[0,0.61111,0,0,0.525],"79":[0,0.61111,0,0,0.525],"80":[0,0.61111,0,0,0.525],"81":[0.13889,0.61111,0,0,0.525],"82":[0,0.61111,0,0,0.525],"83":[0,0.61111,0,0,0.525],"84":[0,0.61111,0,0,0.525],"85":[0,0.61111,0,0,0.525],"86":[0,0.61111,0,0,0.525],"87":[0,0.61111,0,0,0.525],"88":[0,0.61111,0,0,0.525],"89":[0,0.61111,0,0,0.525],"90":[0,0.61111,0,0,0.525],"91":[0.08333,0.69444,0,0,0.525],"92":[0.08333,0.69444,0,0,0.525],"93":[0.08333,0.69444,0,0,0.525],"94":[0,0.61111,0,0,0.525],"95":[0.09514,0,0,0,0.525],"96":[0,0.61111,0,0,0.525],"97":[0,0.43056,0,0,0.525],"98":[0,0.61111,0,0,0.525],"99":[0,0.43056,0,0,0.525],"100":[0,0.61111,0,0,0.525],"101":[0,0.43056,0,0,0.525],"102":[0,0.61111,0,0,0.525],"103":[0.22222,0.43056,0,0,0.525],"104":[0,0.61111,0,0,0.525],"105":[0,0.61111,0,0,0.525],"106":[0.22222,0.61111,0,0,0.525],"107":[0,0.61111,0,0,0.525],"108":[0,0.61111,0,0,0.525],"109":[0,0.43056,0,0,0.525],"110":[0,0.43056,0,0,0.525],"111":[0,0.43056,0,0,0.525],"112":[0.22222,0.43056,0,0,0.525],"113":[0.22222,0.43056,0,0,0.525],"114":[0,0.43056,0,0,0.525],"115":[0,0.43056,0,0,0.525],"116":[0,0.55358,0,0,0.525],"117":[0,0.43056,0,0,0.525],"118":[0,0.43056,0,0,0.525],"119":[0,0.43056,0,0,0.525],"120":[0,0.43056,0,0,0.525],"121":[0.22222,0.43056,0,0,0.525],"122":[0,0.43056,0,0,0.525],"123":[0.08333,0.69444,0,0,0.525],"124":[0.08333,0.69444,0,0,0.525],"125":[0.08333,0.69444,0,0,0.525],"126":[0,0.61111,0,0,0.525],"127":[0,0.61111,0,0,0.525],"160":[0,0,0,0,0.525],"176":[0,0.61111,0,0,0.525],"184":[0.19445,0,0,0,0.525],"305":[0,0.43056,0,0,0.525],"567":[0.22222,0.43056,0,0,0.525],"711":[0,0.56597,0,0,0.525],"713":[0,0.56555,0,0,0.525],"714":[0,0.61111,0,0,0.525],"715":[0,0.61111,0,0,0.525],"728":[0,0.61111,0,0,0.525],"730":[0,0.61111,0,0,0.525],"770":[0,0.61111,0,0,0.525],"771":[0,0.61111,0,0,0.525],"776":[0,0.61111,0,0,0.525],"915":[0,0.61111,0,0,0.525],"916":[0,0.61111,0,0,0.525],"920":[0,0.61111,0,0,0.525],"923":[0,0.61111,0,0,0.525],"926":[0,0.61111,0,0,0.525],"928":[0,0.61111,0,0,0.525],"931":[0,0.61111,0,0,0.525],"933":[0,0.61111,0,0,0.525],"934":[0,0.61111,0,0,0.525],"936":[0,0.61111,0,0,0.525],"937":[0,0.61111,0,0,0.525],"8216":[0,0.61111,0,0,0.525],"8217":[0,0.61111,0,0,0.525],"8242":[0,0.61111,0,0,0.525],"9251":[0.11111,0.21944,0,0,0.525]}};/**
 * This file contains metrics regarding fonts and individual symbols. The sigma
 * and xi variables, as well as the metricMap map contain data extracted from
 * TeX, TeX font metrics, and the TTF files. These data are then exposed via the
 * `metrics` variable and the getCharacterMetrics function.
 */ // In TeX, there are actually three sets of dimensions, one for each of
// textstyle (size index 5 and higher: >=9pt), scriptstyle (size index 3 and 4:
// 7-8pt), and scriptscriptstyle (size index 1 and 2: 5-6pt).  These are
// provided in the the arrays below, in that order.
//
// The font metrics are stored in fonts cmsy10, cmsy7, and cmsy5 respsectively.
// This was determined by running the following script:
//
//     latex -interaction=nonstopmode \
//     '\documentclass{article}\usepackage{amsmath}\begin{document}' \
//     '$a$ \expandafter\show\the\textfont2' \
//     '\expandafter\show\the\scriptfont2' \
//     '\expandafter\show\the\scriptscriptfont2' \
//     '\stop'
//
// The metrics themselves were retreived using the following commands:
//
//     tftopl cmsy10
//     tftopl cmsy7
//     tftopl cmsy5
//
// The output of each of these commands is quite lengthy.  The only part we
// care about is the FONTDIMEN section. Each value is measured in EMs.
const sigmasAndXis={slant:[0.250,0.250,0.250],// sigma1
space:[0.000,0.000,0.000],// sigma2
stretch:[0.000,0.000,0.000],// sigma3
shrink:[0.000,0.000,0.000],// sigma4
xHeight:[0.431,0.431,0.431],// sigma5
quad:[1.000,1.171,1.472],// sigma6
extraSpace:[0.000,0.000,0.000],// sigma7
num1:[0.677,0.732,0.925],// sigma8
num2:[0.394,0.384,0.387],// sigma9
num3:[0.444,0.471,0.504],// sigma10
denom1:[0.686,0.752,1.025],// sigma11
denom2:[0.345,0.344,0.532],// sigma12
sup1:[0.413,0.503,0.504],// sigma13
sup2:[0.363,0.431,0.404],// sigma14
sup3:[0.289,0.286,0.294],// sigma15
sub1:[0.150,0.143,0.200],// sigma16
sub2:[0.247,0.286,0.400],// sigma17
supDrop:[0.386,0.353,0.494],// sigma18
subDrop:[0.050,0.071,0.100],// sigma19
delim1:[2.390,1.700,1.980],// sigma20
delim2:[1.010,1.157,1.420],// sigma21
axisHeight:[0.250,0.250,0.250],// sigma22
// These font metrics are extracted from TeX by using tftopl on cmex10.tfm;
// they correspond to the font parameters of the extension fonts (family 3).
// See the TeXbook, page 441. In AMSTeX, the extension fonts scale; to
// match cmex7, we'd use cmex7.tfm values for script and scriptscript
// values.
defaultRuleThickness:[0.04,0.049,0.049],// xi8; cmex7: 0.049
bigOpSpacing1:[0.111,0.111,0.111],// xi9
bigOpSpacing2:[0.166,0.166,0.166],// xi10
bigOpSpacing3:[0.2,0.2,0.2],// xi11
bigOpSpacing4:[0.6,0.611,0.611],// xi12; cmex7: 0.611
bigOpSpacing5:[0.1,0.143,0.143],// xi13; cmex7: 0.143
// The \sqrt rule width is taken from the height of the surd character.
// Since we use the same font at all sizes, this thickness doesn't scale.
sqrtRuleThickness:[0.04,0.04,0.04],// This value determines how large a pt is, for metrics which are defined
// in terms of pts.
// This value is also used in katex.less; if you change it make sure the
// values match.
ptPerEm:[10.0,10.0,10.0],// The space between adjacent `|` columns in an array definition. From
// `\showthe\doublerulesep` in LaTeX. Equals 2.0 / ptPerEm.
doubleRuleSep:[0.2,0.2,0.2]};// This map contains a mapping from font name and character code to character
// should have Latin-1 and Cyrillic characters, but may not depending on the
// operating system.  The metrics do not account for extra height from the
// accents.  In the case of Cyrillic characters which have both ascenders and
// descenders we prefer approximations with ascenders, primarily to prevent
// the fraction bar or root line from intersecting the glyph.
// TODO(kevinb) allow union of multiple glyph metrics for better accuracy.
const extraCharacterMap={// Latin-1
'Å':'A','Ç':'C','Ð':'D','Þ':'o','å':'a','ç':'c','ð':'d','þ':'o',// Cyrillic
'А':'A','Б':'B','В':'B','Г':'F','Д':'A','Е':'E','Ж':'K','З':'3','И':'N','Й':'N','К':'K','Л':'N','М':'M','Н':'H','О':'O','П':'N','Р':'P','С':'C','Т':'T','У':'y','Ф':'O','Х':'X','Ц':'U','Ч':'h','Ш':'W','Щ':'W','Ъ':'B','Ы':'X','Ь':'B','Э':'3','Ю':'X','Я':'R','а':'a','б':'b','в':'a','г':'r','д':'y','е':'e','ж':'m','з':'e','и':'n','й':'n','к':'n','л':'n','м':'m','н':'n','о':'o','п':'n','р':'p','с':'c','т':'o','у':'y','ф':'b','х':'x','ц':'n','ч':'n','ш':'w','щ':'w','ъ':'a','ы':'m','ь':'a','э':'e','ю':'m','я':'r'};/**
 * This function adds new font metrics to default metricMap
 * It can also override existing metrics
 */function setFontMetrics(fontName,metrics){metricMap[fontName]=metrics;}/**
 * This function is a convenience function for looking up information in the
 * metricMap table. It takes a character as a string, and a font.
 *
 * Note: the `width` property may be undefined if fontMetricsData.js wasn't
 * built using `Make extended_metrics`.
 */function getCharacterMetrics(character,font,mode){if(!metricMap[font]){throw new Error(`Font metrics not found for font: ${font}.`);}let ch=character.charCodeAt(0);if(character[0]in extraCharacterMap){ch=extraCharacterMap[character[0]].charCodeAt(0);}let metrics=metricMap[font][ch];if(!metrics&&mode==='text'){// We don't typically have font metrics for Asian scripts.
// But since we support them in text mode, we need to return
// some sort of metrics.
// So if the character is in a script we support but we
// don't have metrics for it, just use the metrics for
// the Latin capital letter M. This is close enough because
// we (currently) only care about the height of the glpyh
// not its width.
if(supportedCodepoint(ch)){metrics=metricMap[font][77];// 77 is the charcode for 'M'
}}if(metrics){return {depth:metrics[0],height:metrics[1],italic:metrics[2],skew:metrics[3],width:metrics[4]};}}const fontMetricsBySizeIndex={};/**
 * Get the font metrics for a given size.
 */function getGlobalMetrics(size){let sizeIndex;if(size>=5){sizeIndex=0;}else if(size>=3){sizeIndex=1;}else{sizeIndex=2;}if(!fontMetricsBySizeIndex[sizeIndex]){const metrics=fontMetricsBySizeIndex[sizeIndex]={cssEmPerMu:sigmasAndXis.quad[sizeIndex]/18};for(const key in sigmasAndXis){if(sigmasAndXis.hasOwnProperty(key)){metrics[key]=sigmasAndXis[key][sizeIndex];}}}return fontMetricsBySizeIndex[sizeIndex];}/**
 * This file holds a list of all no-argument functions and single-character
 * symbols (like 'a' or ';').
 *
 * For each of the symbols, there are three properties they can have:
 * - font (required): the font to be used for this symbol. Either "main" (the
     normal font), or "ams" (the ams fonts).
 * - group (required): the ParseNode group type the symbol should have (i.e.
     "textord", "mathord", etc).
     See https://github.com/KaTeX/KaTeX/wiki/Examining-TeX#group-types
 * - replace: the character that this symbol or function should be
 *   replaced with (i.e. "\phi" has a replace value of "\u03d5", the phi
 *   character in the main font).
 *
 * The outermost map in the table indicates what mode the symbols should be
 * accepted in (e.g. "math" or "text").
 */ // Some of these have a "-token" suffix since these are also used as `ParseNode`
// types for raw text tokens, and we want to avoid conflicts with higher-level
// `ParseNode` types. These `ParseNode`s are constructed within `Parser` by
// looking up the `symbols` map.
const ATOMS={"bin":1,"close":1,"inner":1,"open":1,"punct":1,"rel":1};const NON_ATOMS={"accent-token":1,"mathord":1,"op-token":1,"spacing":1,"textord":1};const symbols={"math":{},"text":{}};/** `acceptUnicodeChar = true` is only applicable if `replace` is set. */function defineSymbol(mode,font,group,replace,name,acceptUnicodeChar){symbols[mode][name]={font,group,replace};if(acceptUnicodeChar&&replace){symbols[mode][replace]=symbols[mode][name];}}// Some abbreviations for commonly used strings.
// This helps minify the code, and also spotting typos using jshint.
// modes:
const math="math";const text$1="text";// fonts:
const main="main";const ams="ams";// groups:
const accent="accent-token";const bin="bin";const close="close";const inner="inner";const mathord="mathord";const op="op-token";const open="open";const punct="punct";const rel="rel";const spacing="spacing";const textord="textord";// Now comes the symbol table
// Relation Symbols
defineSymbol(math,main,rel,"\u2261","\\equiv",true);defineSymbol(math,main,rel,"\u227a","\\prec",true);defineSymbol(math,main,rel,"\u227b","\\succ",true);defineSymbol(math,main,rel,"\u223c","\\sim",true);defineSymbol(math,main,rel,"\u22a5","\\perp");defineSymbol(math,main,rel,"\u2aaf","\\preceq",true);defineSymbol(math,main,rel,"\u2ab0","\\succeq",true);defineSymbol(math,main,rel,"\u2243","\\simeq",true);defineSymbol(math,main,rel,"\u2223","\\mid",true);defineSymbol(math,main,rel,"\u226a","\\ll",true);defineSymbol(math,main,rel,"\u226b","\\gg",true);defineSymbol(math,main,rel,"\u224d","\\asymp",true);defineSymbol(math,main,rel,"\u2225","\\parallel");defineSymbol(math,main,rel,"\u22c8","\\bowtie",true);defineSymbol(math,main,rel,"\u2323","\\smile",true);defineSymbol(math,main,rel,"\u2291","\\sqsubseteq",true);defineSymbol(math,main,rel,"\u2292","\\sqsupseteq",true);defineSymbol(math,main,rel,"\u2250","\\doteq",true);defineSymbol(math,main,rel,"\u2322","\\frown",true);defineSymbol(math,main,rel,"\u220b","\\ni",true);defineSymbol(math,main,rel,"\u221d","\\propto",true);defineSymbol(math,main,rel,"\u22a2","\\vdash",true);defineSymbol(math,main,rel,"\u22a3","\\dashv",true);defineSymbol(math,main,rel,"\u220b","\\owns");// Punctuation
defineSymbol(math,main,punct,"\u002e","\\ldotp");defineSymbol(math,main,punct,"\u22c5","\\cdotp");// Misc Symbols
defineSymbol(math,main,textord,"\u0023","\\#");defineSymbol(text$1,main,textord,"\u0023","\\#");defineSymbol(math,main,textord,"\u0026","\\&");defineSymbol(text$1,main,textord,"\u0026","\\&");defineSymbol(math,main,textord,"\u2135","\\aleph",true);defineSymbol(math,main,textord,"\u2200","\\forall",true);defineSymbol(math,main,textord,"\u210f","\\hbar",true);defineSymbol(math,main,textord,"\u2203","\\exists",true);defineSymbol(math,main,textord,"\u2207","\\nabla",true);defineSymbol(math,main,textord,"\u266d","\\flat",true);defineSymbol(math,main,textord,"\u2113","\\ell",true);defineSymbol(math,main,textord,"\u266e","\\natural",true);defineSymbol(math,main,textord,"\u2663","\\clubsuit",true);defineSymbol(math,main,textord,"\u2118","\\wp",true);defineSymbol(math,main,textord,"\u266f","\\sharp",true);defineSymbol(math,main,textord,"\u2662","\\diamondsuit",true);defineSymbol(math,main,textord,"\u211c","\\Re",true);defineSymbol(math,main,textord,"\u2661","\\heartsuit",true);defineSymbol(math,main,textord,"\u2111","\\Im",true);defineSymbol(math,main,textord,"\u2660","\\spadesuit",true);defineSymbol(text$1,main,textord,"\u00a7","\\S",true);defineSymbol(text$1,main,textord,"\u00b6","\\P",true);// Math and Text
defineSymbol(math,main,textord,"\u2020","\\dag");defineSymbol(text$1,main,textord,"\u2020","\\dag");defineSymbol(text$1,main,textord,"\u2020","\\textdagger");defineSymbol(math,main,textord,"\u2021","\\ddag");defineSymbol(text$1,main,textord,"\u2021","\\ddag");defineSymbol(text$1,main,textord,"\u2021","\\textdaggerdbl");// Large Delimiters
defineSymbol(math,main,close,"\u23b1","\\rmoustache",true);defineSymbol(math,main,open,"\u23b0","\\lmoustache",true);defineSymbol(math,main,close,"\u27ef","\\rgroup",true);defineSymbol(math,main,open,"\u27ee","\\lgroup",true);// Binary Operators
defineSymbol(math,main,bin,"\u2213","\\mp",true);defineSymbol(math,main,bin,"\u2296","\\ominus",true);defineSymbol(math,main,bin,"\u228e","\\uplus",true);defineSymbol(math,main,bin,"\u2293","\\sqcap",true);defineSymbol(math,main,bin,"\u2217","\\ast");defineSymbol(math,main,bin,"\u2294","\\sqcup",true);defineSymbol(math,main,bin,"\u25ef","\\bigcirc");defineSymbol(math,main,bin,"\u2219","\\bullet");defineSymbol(math,main,bin,"\u2021","\\ddagger");defineSymbol(math,main,bin,"\u2240","\\wr",true);defineSymbol(math,main,bin,"\u2a3f","\\amalg");defineSymbol(math,main,bin,"\u0026","\\And");// from amsmath
// Arrow Symbols
defineSymbol(math,main,rel,"\u27f5","\\longleftarrow",true);defineSymbol(math,main,rel,"\u21d0","\\Leftarrow",true);defineSymbol(math,main,rel,"\u27f8","\\Longleftarrow",true);defineSymbol(math,main,rel,"\u27f6","\\longrightarrow",true);defineSymbol(math,main,rel,"\u21d2","\\Rightarrow",true);defineSymbol(math,main,rel,"\u27f9","\\Longrightarrow",true);defineSymbol(math,main,rel,"\u2194","\\leftrightarrow",true);defineSymbol(math,main,rel,"\u27f7","\\longleftrightarrow",true);defineSymbol(math,main,rel,"\u21d4","\\Leftrightarrow",true);defineSymbol(math,main,rel,"\u27fa","\\Longleftrightarrow",true);defineSymbol(math,main,rel,"\u21a6","\\mapsto",true);defineSymbol(math,main,rel,"\u27fc","\\longmapsto",true);defineSymbol(math,main,rel,"\u2197","\\nearrow",true);defineSymbol(math,main,rel,"\u21a9","\\hookleftarrow",true);defineSymbol(math,main,rel,"\u21aa","\\hookrightarrow",true);defineSymbol(math,main,rel,"\u2198","\\searrow",true);defineSymbol(math,main,rel,"\u21bc","\\leftharpoonup",true);defineSymbol(math,main,rel,"\u21c0","\\rightharpoonup",true);defineSymbol(math,main,rel,"\u2199","\\swarrow",true);defineSymbol(math,main,rel,"\u21bd","\\leftharpoondown",true);defineSymbol(math,main,rel,"\u21c1","\\rightharpoondown",true);defineSymbol(math,main,rel,"\u2196","\\nwarrow",true);defineSymbol(math,main,rel,"\u21cc","\\rightleftharpoons",true);// AMS Negated Binary Relations
defineSymbol(math,ams,rel,"\u226e","\\nless",true);defineSymbol(math,ams,rel,"\ue010","\\nleqslant");defineSymbol(math,ams,rel,"\ue011","\\nleqq");defineSymbol(math,ams,rel,"\u2a87","\\lneq",true);defineSymbol(math,ams,rel,"\u2268","\\lneqq",true);defineSymbol(math,ams,rel,"\ue00c","\\lvertneqq");defineSymbol(math,ams,rel,"\u22e6","\\lnsim",true);defineSymbol(math,ams,rel,"\u2a89","\\lnapprox",true);defineSymbol(math,ams,rel,"\u2280","\\nprec",true);// unicode-math maps \u22e0 to \npreccurlyeq. We'll use the AMS synonym.
defineSymbol(math,ams,rel,"\u22e0","\\npreceq",true);defineSymbol(math,ams,rel,"\u22e8","\\precnsim",true);defineSymbol(math,ams,rel,"\u2ab9","\\precnapprox",true);defineSymbol(math,ams,rel,"\u2241","\\nsim",true);defineSymbol(math,ams,rel,"\ue006","\\nshortmid");defineSymbol(math,ams,rel,"\u2224","\\nmid",true);defineSymbol(math,ams,rel,"\u22ac","\\nvdash",true);defineSymbol(math,ams,rel,"\u22ad","\\nvDash",true);defineSymbol(math,ams,rel,"\u22ea","\\ntriangleleft");defineSymbol(math,ams,rel,"\u22ec","\\ntrianglelefteq",true);defineSymbol(math,ams,rel,"\u228a","\\subsetneq",true);defineSymbol(math,ams,rel,"\ue01a","\\varsubsetneq");defineSymbol(math,ams,rel,"\u2acb","\\subsetneqq",true);defineSymbol(math,ams,rel,"\ue017","\\varsubsetneqq");defineSymbol(math,ams,rel,"\u226f","\\ngtr",true);defineSymbol(math,ams,rel,"\ue00f","\\ngeqslant");defineSymbol(math,ams,rel,"\ue00e","\\ngeqq");defineSymbol(math,ams,rel,"\u2a88","\\gneq",true);defineSymbol(math,ams,rel,"\u2269","\\gneqq",true);defineSymbol(math,ams,rel,"\ue00d","\\gvertneqq");defineSymbol(math,ams,rel,"\u22e7","\\gnsim",true);defineSymbol(math,ams,rel,"\u2a8a","\\gnapprox",true);defineSymbol(math,ams,rel,"\u2281","\\nsucc",true);// unicode-math maps \u22e1 to \nsucccurlyeq. We'll use the AMS synonym.
defineSymbol(math,ams,rel,"\u22e1","\\nsucceq",true);defineSymbol(math,ams,rel,"\u22e9","\\succnsim",true);defineSymbol(math,ams,rel,"\u2aba","\\succnapprox",true);// unicode-math maps \u2246 to \simneqq. We'll use the AMS synonym.
defineSymbol(math,ams,rel,"\u2246","\\ncong",true);defineSymbol(math,ams,rel,"\ue007","\\nshortparallel");defineSymbol(math,ams,rel,"\u2226","\\nparallel",true);defineSymbol(math,ams,rel,"\u22af","\\nVDash",true);defineSymbol(math,ams,rel,"\u22eb","\\ntriangleright");defineSymbol(math,ams,rel,"\u22ed","\\ntrianglerighteq",true);defineSymbol(math,ams,rel,"\ue018","\\nsupseteqq");defineSymbol(math,ams,rel,"\u228b","\\supsetneq",true);defineSymbol(math,ams,rel,"\ue01b","\\varsupsetneq");defineSymbol(math,ams,rel,"\u2acc","\\supsetneqq",true);defineSymbol(math,ams,rel,"\ue019","\\varsupsetneqq");defineSymbol(math,ams,rel,"\u22ae","\\nVdash",true);defineSymbol(math,ams,rel,"\u2ab5","\\precneqq",true);defineSymbol(math,ams,rel,"\u2ab6","\\succneqq",true);defineSymbol(math,ams,rel,"\ue016","\\nsubseteqq");defineSymbol(math,ams,bin,"\u22b4","\\unlhd");defineSymbol(math,ams,bin,"\u22b5","\\unrhd");// AMS Negated Arrows
defineSymbol(math,ams,rel,"\u219a","\\nleftarrow",true);defineSymbol(math,ams,rel,"\u219b","\\nrightarrow",true);defineSymbol(math,ams,rel,"\u21cd","\\nLeftarrow",true);defineSymbol(math,ams,rel,"\u21cf","\\nRightarrow",true);defineSymbol(math,ams,rel,"\u21ae","\\nleftrightarrow",true);defineSymbol(math,ams,rel,"\u21ce","\\nLeftrightarrow",true);// AMS Misc
defineSymbol(math,ams,rel,"\u25b3","\\vartriangle");defineSymbol(math,ams,textord,"\u210f","\\hslash");defineSymbol(math,ams,textord,"\u25bd","\\triangledown");defineSymbol(math,ams,textord,"\u25ca","\\lozenge");defineSymbol(math,ams,textord,"\u24c8","\\circledS");defineSymbol(math,ams,textord,"\u00ae","\\circledR");defineSymbol(text$1,ams,textord,"\u00ae","\\circledR");defineSymbol(math,ams,textord,"\u2221","\\measuredangle",true);defineSymbol(math,ams,textord,"\u2204","\\nexists");defineSymbol(math,ams,textord,"\u2127","\\mho");defineSymbol(math,ams,textord,"\u2132","\\Finv",true);defineSymbol(math,ams,textord,"\u2141","\\Game",true);defineSymbol(math,ams,textord,"\u006b","\\Bbbk");defineSymbol(math,ams,textord,"\u2035","\\backprime");defineSymbol(math,ams,textord,"\u25b2","\\blacktriangle");defineSymbol(math,ams,textord,"\u25bc","\\blacktriangledown");defineSymbol(math,ams,textord,"\u25a0","\\blacksquare");defineSymbol(math,ams,textord,"\u29eb","\\blacklozenge");defineSymbol(math,ams,textord,"\u2605","\\bigstar");defineSymbol(math,ams,textord,"\u2222","\\sphericalangle",true);defineSymbol(math,ams,textord,"\u2201","\\complement",true);// unicode-math maps U+F0 (ð) to \matheth. We map to AMS function \eth
defineSymbol(math,ams,textord,"\u00f0","\\eth",true);defineSymbol(math,ams,textord,"\u2571","\\diagup");defineSymbol(math,ams,textord,"\u2572","\\diagdown");defineSymbol(math,ams,textord,"\u25a1","\\square");defineSymbol(math,ams,textord,"\u25a1","\\Box");defineSymbol(math,ams,textord,"\u25ca","\\Diamond");// unicode-math maps U+A5 to \mathyen. We map to AMS function \yen
defineSymbol(math,ams,textord,"\u00a5","\\yen",true);defineSymbol(text$1,ams,textord,"\u00a5","\\yen",true);defineSymbol(math,ams,textord,"\u2713","\\checkmark",true);defineSymbol(text$1,ams,textord,"\u2713","\\checkmark");// AMS Hebrew
defineSymbol(math,ams,textord,"\u2136","\\beth",true);defineSymbol(math,ams,textord,"\u2138","\\daleth",true);defineSymbol(math,ams,textord,"\u2137","\\gimel",true);// AMS Greek
defineSymbol(math,ams,textord,"\u03dd","\\digamma");defineSymbol(math,ams,textord,"\u03f0","\\varkappa");// AMS Delimiters
defineSymbol(math,ams,open,"\u250c","\\ulcorner",true);defineSymbol(math,ams,close,"\u2510","\\urcorner",true);defineSymbol(math,ams,open,"\u2514","\\llcorner",true);defineSymbol(math,ams,close,"\u2518","\\lrcorner",true);// AMS Binary Relations
defineSymbol(math,ams,rel,"\u2266","\\leqq",true);defineSymbol(math,ams,rel,"\u2a7d","\\leqslant",true);defineSymbol(math,ams,rel,"\u2a95","\\eqslantless",true);defineSymbol(math,ams,rel,"\u2272","\\lesssim",true);defineSymbol(math,ams,rel,"\u2a85","\\lessapprox",true);defineSymbol(math,ams,rel,"\u224a","\\approxeq",true);defineSymbol(math,ams,bin,"\u22d6","\\lessdot");defineSymbol(math,ams,rel,"\u22d8","\\lll",true);defineSymbol(math,ams,rel,"\u2276","\\lessgtr",true);defineSymbol(math,ams,rel,"\u22da","\\lesseqgtr",true);defineSymbol(math,ams,rel,"\u2a8b","\\lesseqqgtr",true);defineSymbol(math,ams,rel,"\u2251","\\doteqdot");defineSymbol(math,ams,rel,"\u2253","\\risingdotseq",true);defineSymbol(math,ams,rel,"\u2252","\\fallingdotseq",true);defineSymbol(math,ams,rel,"\u223d","\\backsim",true);defineSymbol(math,ams,rel,"\u22cd","\\backsimeq",true);defineSymbol(math,ams,rel,"\u2ac5","\\subseteqq",true);defineSymbol(math,ams,rel,"\u22d0","\\Subset",true);defineSymbol(math,ams,rel,"\u228f","\\sqsubset",true);defineSymbol(math,ams,rel,"\u227c","\\preccurlyeq",true);defineSymbol(math,ams,rel,"\u22de","\\curlyeqprec",true);defineSymbol(math,ams,rel,"\u227e","\\precsim",true);defineSymbol(math,ams,rel,"\u2ab7","\\precapprox",true);defineSymbol(math,ams,rel,"\u22b2","\\vartriangleleft");defineSymbol(math,ams,rel,"\u22b4","\\trianglelefteq");defineSymbol(math,ams,rel,"\u22a8","\\vDash",true);defineSymbol(math,ams,rel,"\u22aa","\\Vvdash",true);defineSymbol(math,ams,rel,"\u2323","\\smallsmile");defineSymbol(math,ams,rel,"\u2322","\\smallfrown");defineSymbol(math,ams,rel,"\u224f","\\bumpeq",true);defineSymbol(math,ams,rel,"\u224e","\\Bumpeq",true);defineSymbol(math,ams,rel,"\u2267","\\geqq",true);defineSymbol(math,ams,rel,"\u2a7e","\\geqslant",true);defineSymbol(math,ams,rel,"\u2a96","\\eqslantgtr",true);defineSymbol(math,ams,rel,"\u2273","\\gtrsim",true);defineSymbol(math,ams,rel,"\u2a86","\\gtrapprox",true);defineSymbol(math,ams,bin,"\u22d7","\\gtrdot");defineSymbol(math,ams,rel,"\u22d9","\\ggg",true);defineSymbol(math,ams,rel,"\u2277","\\gtrless",true);defineSymbol(math,ams,rel,"\u22db","\\gtreqless",true);defineSymbol(math,ams,rel,"\u2a8c","\\gtreqqless",true);defineSymbol(math,ams,rel,"\u2256","\\eqcirc",true);defineSymbol(math,ams,rel,"\u2257","\\circeq",true);defineSymbol(math,ams,rel,"\u225c","\\triangleq",true);defineSymbol(math,ams,rel,"\u223c","\\thicksim");defineSymbol(math,ams,rel,"\u2248","\\thickapprox");defineSymbol(math,ams,rel,"\u2ac6","\\supseteqq",true);defineSymbol(math,ams,rel,"\u22d1","\\Supset",true);defineSymbol(math,ams,rel,"\u2290","\\sqsupset",true);defineSymbol(math,ams,rel,"\u227d","\\succcurlyeq",true);defineSymbol(math,ams,rel,"\u22df","\\curlyeqsucc",true);defineSymbol(math,ams,rel,"\u227f","\\succsim",true);defineSymbol(math,ams,rel,"\u2ab8","\\succapprox",true);defineSymbol(math,ams,rel,"\u22b3","\\vartriangleright");defineSymbol(math,ams,rel,"\u22b5","\\trianglerighteq");defineSymbol(math,ams,rel,"\u22a9","\\Vdash",true);defineSymbol(math,ams,rel,"\u2223","\\shortmid");defineSymbol(math,ams,rel,"\u2225","\\shortparallel");defineSymbol(math,ams,rel,"\u226c","\\between",true);defineSymbol(math,ams,rel,"\u22d4","\\pitchfork",true);defineSymbol(math,ams,rel,"\u221d","\\varpropto");defineSymbol(math,ams,rel,"\u25c0","\\blacktriangleleft");// unicode-math says that \therefore is a mathord atom.
// We kept the amssymb atom type, which is rel.
defineSymbol(math,ams,rel,"\u2234","\\therefore",true);defineSymbol(math,ams,rel,"\u220d","\\backepsilon");defineSymbol(math,ams,rel,"\u25b6","\\blacktriangleright");// unicode-math says that \because is a mathord atom.
// We kept the amssymb atom type, which is rel.
defineSymbol(math,ams,rel,"\u2235","\\because",true);defineSymbol(math,ams,rel,"\u22d8","\\llless");defineSymbol(math,ams,rel,"\u22d9","\\gggtr");defineSymbol(math,ams,bin,"\u22b2","\\lhd");defineSymbol(math,ams,bin,"\u22b3","\\rhd");defineSymbol(math,ams,rel,"\u2242","\\eqsim",true);defineSymbol(math,main,rel,"\u22c8","\\Join");defineSymbol(math,ams,rel,"\u2251","\\Doteq",true);// AMS Binary Operators
defineSymbol(math,ams,bin,"\u2214","\\dotplus",true);defineSymbol(math,ams,bin,"\u2216","\\smallsetminus");defineSymbol(math,ams,bin,"\u22d2","\\Cap",true);defineSymbol(math,ams,bin,"\u22d3","\\Cup",true);defineSymbol(math,ams,bin,"\u2a5e","\\doublebarwedge",true);defineSymbol(math,ams,bin,"\u229f","\\boxminus",true);defineSymbol(math,ams,bin,"\u229e","\\boxplus",true);defineSymbol(math,ams,bin,"\u22c7","\\divideontimes",true);defineSymbol(math,ams,bin,"\u22c9","\\ltimes",true);defineSymbol(math,ams,bin,"\u22ca","\\rtimes",true);defineSymbol(math,ams,bin,"\u22cb","\\leftthreetimes",true);defineSymbol(math,ams,bin,"\u22cc","\\rightthreetimes",true);defineSymbol(math,ams,bin,"\u22cf","\\curlywedge",true);defineSymbol(math,ams,bin,"\u22ce","\\curlyvee",true);defineSymbol(math,ams,bin,"\u229d","\\circleddash",true);defineSymbol(math,ams,bin,"\u229b","\\circledast",true);defineSymbol(math,ams,bin,"\u22c5","\\centerdot");defineSymbol(math,ams,bin,"\u22ba","\\intercal",true);defineSymbol(math,ams,bin,"\u22d2","\\doublecap");defineSymbol(math,ams,bin,"\u22d3","\\doublecup");defineSymbol(math,ams,bin,"\u22a0","\\boxtimes",true);// AMS Arrows
// Note: unicode-math maps \u21e2 to their own function \rightdasharrow.
// We'll map it to AMS function \dashrightarrow. It produces the same atom.
defineSymbol(math,ams,rel,"\u21e2","\\dashrightarrow",true);// unicode-math maps \u21e0 to \leftdasharrow. We'll use the AMS synonym.
defineSymbol(math,ams,rel,"\u21e0","\\dashleftarrow",true);defineSymbol(math,ams,rel,"\u21c7","\\leftleftarrows",true);defineSymbol(math,ams,rel,"\u21c6","\\leftrightarrows",true);defineSymbol(math,ams,rel,"\u21da","\\Lleftarrow",true);defineSymbol(math,ams,rel,"\u219e","\\twoheadleftarrow",true);defineSymbol(math,ams,rel,"\u21a2","\\leftarrowtail",true);defineSymbol(math,ams,rel,"\u21ab","\\looparrowleft",true);defineSymbol(math,ams,rel,"\u21cb","\\leftrightharpoons",true);defineSymbol(math,ams,rel,"\u21b6","\\curvearrowleft",true);// unicode-math maps \u21ba to \acwopencirclearrow. We'll use the AMS synonym.
defineSymbol(math,ams,rel,"\u21ba","\\circlearrowleft",true);defineSymbol(math,ams,rel,"\u21b0","\\Lsh",true);defineSymbol(math,ams,rel,"\u21c8","\\upuparrows",true);defineSymbol(math,ams,rel,"\u21bf","\\upharpoonleft",true);defineSymbol(math,ams,rel,"\u21c3","\\downharpoonleft",true);defineSymbol(math,ams,rel,"\u22b8","\\multimap",true);defineSymbol(math,ams,rel,"\u21ad","\\leftrightsquigarrow",true);defineSymbol(math,ams,rel,"\u21c9","\\rightrightarrows",true);defineSymbol(math,ams,rel,"\u21c4","\\rightleftarrows",true);defineSymbol(math,ams,rel,"\u21a0","\\twoheadrightarrow",true);defineSymbol(math,ams,rel,"\u21a3","\\rightarrowtail",true);defineSymbol(math,ams,rel,"\u21ac","\\looparrowright",true);defineSymbol(math,ams,rel,"\u21b7","\\curvearrowright",true);// unicode-math maps \u21bb to \cwopencirclearrow. We'll use the AMS synonym.
defineSymbol(math,ams,rel,"\u21bb","\\circlearrowright",true);defineSymbol(math,ams,rel,"\u21b1","\\Rsh",true);defineSymbol(math,ams,rel,"\u21ca","\\downdownarrows",true);defineSymbol(math,ams,rel,"\u21be","\\upharpoonright",true);defineSymbol(math,ams,rel,"\u21c2","\\downharpoonright",true);defineSymbol(math,ams,rel,"\u21dd","\\rightsquigarrow",true);defineSymbol(math,ams,rel,"\u21dd","\\leadsto");defineSymbol(math,ams,rel,"\u21db","\\Rrightarrow",true);defineSymbol(math,ams,rel,"\u21be","\\restriction");defineSymbol(math,main,textord,"\u2018","`");defineSymbol(math,main,textord,"$","\\$");defineSymbol(text$1,main,textord,"$","\\$");defineSymbol(text$1,main,textord,"$","\\textdollar");defineSymbol(math,main,textord,"%","\\%");defineSymbol(text$1,main,textord,"%","\\%");defineSymbol(math,main,textord,"_","\\_");defineSymbol(text$1,main,textord,"_","\\_");defineSymbol(text$1,main,textord,"_","\\textunderscore");defineSymbol(math,main,textord,"\u2220","\\angle",true);defineSymbol(math,main,textord,"\u221e","\\infty",true);defineSymbol(math,main,textord,"\u2032","\\prime");defineSymbol(math,main,textord,"\u25b3","\\triangle");defineSymbol(math,main,textord,"\u0393","\\Gamma",true);defineSymbol(math,main,textord,"\u0394","\\Delta",true);defineSymbol(math,main,textord,"\u0398","\\Theta",true);defineSymbol(math,main,textord,"\u039b","\\Lambda",true);defineSymbol(math,main,textord,"\u039e","\\Xi",true);defineSymbol(math,main,textord,"\u03a0","\\Pi",true);defineSymbol(math,main,textord,"\u03a3","\\Sigma",true);defineSymbol(math,main,textord,"\u03a5","\\Upsilon",true);defineSymbol(math,main,textord,"\u03a6","\\Phi",true);defineSymbol(math,main,textord,"\u03a8","\\Psi",true);defineSymbol(math,main,textord,"\u03a9","\\Omega",true);defineSymbol(math,main,textord,"A","\u0391");defineSymbol(math,main,textord,"B","\u0392");defineSymbol(math,main,textord,"E","\u0395");defineSymbol(math,main,textord,"Z","\u0396");defineSymbol(math,main,textord,"H","\u0397");defineSymbol(math,main,textord,"I","\u0399");defineSymbol(math,main,textord,"K","\u039A");defineSymbol(math,main,textord,"M","\u039C");defineSymbol(math,main,textord,"N","\u039D");defineSymbol(math,main,textord,"O","\u039F");defineSymbol(math,main,textord,"P","\u03A1");defineSymbol(math,main,textord,"T","\u03A4");defineSymbol(math,main,textord,"X","\u03A7");defineSymbol(math,main,textord,"\u00ac","\\neg",true);defineSymbol(math,main,textord,"\u00ac","\\lnot");defineSymbol(math,main,textord,"\u22a4","\\top");defineSymbol(math,main,textord,"\u22a5","\\bot");defineSymbol(math,main,textord,"\u2205","\\emptyset");defineSymbol(math,ams,textord,"\u2205","\\varnothing");defineSymbol(math,main,mathord,"\u03b1","\\alpha",true);defineSymbol(math,main,mathord,"\u03b2","\\beta",true);defineSymbol(math,main,mathord,"\u03b3","\\gamma",true);defineSymbol(math,main,mathord,"\u03b4","\\delta",true);defineSymbol(math,main,mathord,"\u03f5","\\epsilon",true);defineSymbol(math,main,mathord,"\u03b6","\\zeta",true);defineSymbol(math,main,mathord,"\u03b7","\\eta",true);defineSymbol(math,main,mathord,"\u03b8","\\theta",true);defineSymbol(math,main,mathord,"\u03b9","\\iota",true);defineSymbol(math,main,mathord,"\u03ba","\\kappa",true);defineSymbol(math,main,mathord,"\u03bb","\\lambda",true);defineSymbol(math,main,mathord,"\u03bc","\\mu",true);defineSymbol(math,main,mathord,"\u03bd","\\nu",true);defineSymbol(math,main,mathord,"\u03be","\\xi",true);defineSymbol(math,main,mathord,"\u03bf","\\omicron",true);defineSymbol(math,main,mathord,"\u03c0","\\pi",true);defineSymbol(math,main,mathord,"\u03c1","\\rho",true);defineSymbol(math,main,mathord,"\u03c3","\\sigma",true);defineSymbol(math,main,mathord,"\u03c4","\\tau",true);defineSymbol(math,main,mathord,"\u03c5","\\upsilon",true);defineSymbol(math,main,mathord,"\u03d5","\\phi",true);defineSymbol(math,main,mathord,"\u03c7","\\chi",true);defineSymbol(math,main,mathord,"\u03c8","\\psi",true);defineSymbol(math,main,mathord,"\u03c9","\\omega",true);defineSymbol(math,main,mathord,"\u03b5","\\varepsilon",true);defineSymbol(math,main,mathord,"\u03d1","\\vartheta",true);defineSymbol(math,main,mathord,"\u03d6","\\varpi",true);defineSymbol(math,main,mathord,"\u03f1","\\varrho",true);defineSymbol(math,main,mathord,"\u03c2","\\varsigma",true);defineSymbol(math,main,mathord,"\u03c6","\\varphi",true);defineSymbol(math,main,bin,"\u2217","*");defineSymbol(math,main,bin,"+","+");defineSymbol(math,main,bin,"\u2212","-");defineSymbol(math,main,bin,"\u22c5","\\cdot",true);defineSymbol(math,main,bin,"\u2218","\\circ");defineSymbol(math,main,bin,"\u00f7","\\div",true);defineSymbol(math,main,bin,"\u00b1","\\pm",true);defineSymbol(math,main,bin,"\u00d7","\\times",true);defineSymbol(math,main,bin,"\u2229","\\cap",true);defineSymbol(math,main,bin,"\u222a","\\cup",true);defineSymbol(math,main,bin,"\u2216","\\setminus");defineSymbol(math,main,bin,"\u2227","\\land");defineSymbol(math,main,bin,"\u2228","\\lor");defineSymbol(math,main,bin,"\u2227","\\wedge",true);defineSymbol(math,main,bin,"\u2228","\\vee",true);defineSymbol(math,main,textord,"\u221a","\\surd");defineSymbol(math,main,open,"(","(");defineSymbol(math,main,open,"[","[");defineSymbol(math,main,open,"\u27e8","\\langle",true);defineSymbol(math,main,open,"\u2223","\\lvert");defineSymbol(math,main,open,"\u2225","\\lVert");defineSymbol(math,main,close,")",")");defineSymbol(math,main,close,"]","]");defineSymbol(math,main,close,"?","?");defineSymbol(math,main,close,"!","!");defineSymbol(math,main,close,"\u27e9","\\rangle",true);defineSymbol(math,main,close,"\u2223","\\rvert");defineSymbol(math,main,close,"\u2225","\\rVert");defineSymbol(math,main,rel,"=","=");defineSymbol(math,main,rel,"<","<");defineSymbol(math,main,rel,">",">");defineSymbol(math,main,rel,":",":");defineSymbol(math,main,rel,"\u2248","\\approx",true);defineSymbol(math,main,rel,"\u2245","\\cong",true);defineSymbol(math,main,rel,"\u2265","\\ge");defineSymbol(math,main,rel,"\u2265","\\geq",true);defineSymbol(math,main,rel,"\u2190","\\gets");defineSymbol(math,main,rel,">","\\gt");defineSymbol(math,main,rel,"\u2208","\\in",true);defineSymbol(math,main,rel,"\ue020","\\@not");defineSymbol(math,main,rel,"\u2282","\\subset",true);defineSymbol(math,main,rel,"\u2283","\\supset",true);defineSymbol(math,main,rel,"\u2286","\\subseteq",true);defineSymbol(math,main,rel,"\u2287","\\supseteq",true);defineSymbol(math,ams,rel,"\u2288","\\nsubseteq",true);defineSymbol(math,ams,rel,"\u2289","\\nsupseteq",true);defineSymbol(math,main,rel,"\u22a8","\\models");defineSymbol(math,main,rel,"\u2190","\\leftarrow",true);defineSymbol(math,main,rel,"\u2264","\\le");defineSymbol(math,main,rel,"\u2264","\\leq",true);defineSymbol(math,main,rel,"<","\\lt");defineSymbol(math,main,rel,"\u2192","\\rightarrow",true);defineSymbol(math,main,rel,"\u2192","\\to");defineSymbol(math,ams,rel,"\u2271","\\ngeq",true);defineSymbol(math,ams,rel,"\u2270","\\nleq",true);defineSymbol(math,main,spacing,"\u00a0","\\ ");defineSymbol(math,main,spacing,"\u00a0","~");defineSymbol(math,main,spacing,"\u00a0","\\space");// Ref: LaTeX Source 2e: \DeclareRobustCommand{\nobreakspace}{%
defineSymbol(math,main,spacing,"\u00a0","\\nobreakspace");defineSymbol(text$1,main,spacing,"\u00a0","\\ ");defineSymbol(text$1,main,spacing,"\u00a0","~");defineSymbol(text$1,main,spacing,"\u00a0","\\space");defineSymbol(text$1,main,spacing,"\u00a0","\\nobreakspace");defineSymbol(math,main,spacing,null,"\\nobreak");defineSymbol(math,main,spacing,null,"\\allowbreak");defineSymbol(math,main,punct,",",",");defineSymbol(math,main,punct,";",";");defineSymbol(math,ams,bin,"\u22bc","\\barwedge",true);defineSymbol(math,ams,bin,"\u22bb","\\veebar",true);defineSymbol(math,main,bin,"\u2299","\\odot",true);defineSymbol(math,main,bin,"\u2295","\\oplus",true);defineSymbol(math,main,bin,"\u2297","\\otimes",true);defineSymbol(math,main,textord,"\u2202","\\partial",true);defineSymbol(math,main,bin,"\u2298","\\oslash",true);defineSymbol(math,ams,bin,"\u229a","\\circledcirc",true);defineSymbol(math,ams,bin,"\u22a1","\\boxdot",true);defineSymbol(math,main,bin,"\u25b3","\\bigtriangleup");defineSymbol(math,main,bin,"\u25bd","\\bigtriangledown");defineSymbol(math,main,bin,"\u2020","\\dagger");defineSymbol(math,main,bin,"\u22c4","\\diamond");defineSymbol(math,main,bin,"\u22c6","\\star");defineSymbol(math,main,bin,"\u25c3","\\triangleleft");defineSymbol(math,main,bin,"\u25b9","\\triangleright");defineSymbol(math,main,open,"{","\\{");defineSymbol(text$1,main,textord,"{","\\{");defineSymbol(text$1,main,textord,"{","\\textbraceleft");defineSymbol(math,main,close,"}","\\}");defineSymbol(text$1,main,textord,"}","\\}");defineSymbol(text$1,main,textord,"}","\\textbraceright");defineSymbol(math,main,open,"{","\\lbrace");defineSymbol(math,main,close,"}","\\rbrace");defineSymbol(math,main,open,"[","\\lbrack");defineSymbol(text$1,main,textord,"[","\\lbrack");defineSymbol(math,main,close,"]","\\rbrack");defineSymbol(text$1,main,textord,"]","\\rbrack");defineSymbol(math,main,open,"(","\\lparen");defineSymbol(math,main,close,")","\\rparen");defineSymbol(text$1,main,textord,"<","\\textless");// in T1 fontenc
defineSymbol(text$1,main,textord,">","\\textgreater");// in T1 fontenc
defineSymbol(math,main,open,"\u230a","\\lfloor",true);defineSymbol(math,main,close,"\u230b","\\rfloor",true);defineSymbol(math,main,open,"\u2308","\\lceil",true);defineSymbol(math,main,close,"\u2309","\\rceil",true);defineSymbol(math,main,textord,"\\","\\backslash");defineSymbol(math,main,textord,"\u2223","|");defineSymbol(math,main,textord,"\u2223","\\vert");defineSymbol(text$1,main,textord,"|","\\textbar");// in T1 fontenc
defineSymbol(math,main,textord,"\u2225","\\|");defineSymbol(math,main,textord,"\u2225","\\Vert");defineSymbol(text$1,main,textord,"\u2225","\\textbardbl");defineSymbol(text$1,main,textord,"~","\\textasciitilde");defineSymbol(text$1,main,textord,"\\","\\textbackslash");defineSymbol(text$1,main,textord,"^","\\textasciicircum");defineSymbol(math,main,rel,"\u2191","\\uparrow",true);defineSymbol(math,main,rel,"\u21d1","\\Uparrow",true);defineSymbol(math,main,rel,"\u2193","\\downarrow",true);defineSymbol(math,main,rel,"\u21d3","\\Downarrow",true);defineSymbol(math,main,rel,"\u2195","\\updownarrow",true);defineSymbol(math,main,rel,"\u21d5","\\Updownarrow",true);defineSymbol(math,main,op,"\u2210","\\coprod");defineSymbol(math,main,op,"\u22c1","\\bigvee");defineSymbol(math,main,op,"\u22c0","\\bigwedge");defineSymbol(math,main,op,"\u2a04","\\biguplus");defineSymbol(math,main,op,"\u22c2","\\bigcap");defineSymbol(math,main,op,"\u22c3","\\bigcup");defineSymbol(math,main,op,"\u222b","\\int");defineSymbol(math,main,op,"\u222b","\\intop");defineSymbol(math,main,op,"\u222c","\\iint");defineSymbol(math,main,op,"\u222d","\\iiint");defineSymbol(math,main,op,"\u220f","\\prod");defineSymbol(math,main,op,"\u2211","\\sum");defineSymbol(math,main,op,"\u2a02","\\bigotimes");defineSymbol(math,main,op,"\u2a01","\\bigoplus");defineSymbol(math,main,op,"\u2a00","\\bigodot");defineSymbol(math,main,op,"\u222e","\\oint");defineSymbol(math,main,op,"\u222f","\\oiint");defineSymbol(math,main,op,"\u2230","\\oiiint");defineSymbol(math,main,op,"\u2a06","\\bigsqcup");defineSymbol(math,main,op,"\u222b","\\smallint");defineSymbol(text$1,main,inner,"\u2026","\\textellipsis");defineSymbol(math,main,inner,"\u2026","\\mathellipsis");defineSymbol(text$1,main,inner,"\u2026","\\ldots",true);defineSymbol(math,main,inner,"\u2026","\\ldots",true);defineSymbol(math,main,inner,"\u22ef","\\@cdots",true);defineSymbol(math,main,inner,"\u22f1","\\ddots",true);defineSymbol(math,main,textord,"\u22ee","\\varvdots");// \vdots is a macro
defineSymbol(math,main,accent,"\u02ca","\\acute");defineSymbol(math,main,accent,"\u02cb","\\grave");defineSymbol(math,main,accent,"\u00a8","\\ddot");defineSymbol(math,main,accent,"\u007e","\\tilde");defineSymbol(math,main,accent,"\u02c9","\\bar");defineSymbol(math,main,accent,"\u02d8","\\breve");defineSymbol(math,main,accent,"\u02c7","\\check");defineSymbol(math,main,accent,"\u005e","\\hat");defineSymbol(math,main,accent,"\u20d7","\\vec");defineSymbol(math,main,accent,"\u02d9","\\dot");defineSymbol(math,main,accent,"\u02da","\\mathring");defineSymbol(math,main,mathord,"\u0131","\\imath",true);defineSymbol(math,main,mathord,"\u0237","\\jmath",true);defineSymbol(text$1,main,textord,"\u0131","\\i",true);defineSymbol(text$1,main,textord,"\u0237","\\j",true);defineSymbol(text$1,main,textord,"\u00df","\\ss",true);defineSymbol(text$1,main,textord,"\u00e6","\\ae",true);defineSymbol(text$1,main,textord,"\u00e6","\\ae",true);defineSymbol(text$1,main,textord,"\u0153","\\oe",true);defineSymbol(text$1,main,textord,"\u00f8","\\o",true);defineSymbol(text$1,main,textord,"\u00c6","\\AE",true);defineSymbol(text$1,main,textord,"\u0152","\\OE",true);defineSymbol(text$1,main,textord,"\u00d8","\\O",true);defineSymbol(text$1,main,accent,"\u02ca","\\'");// acute
defineSymbol(text$1,main,accent,"\u02cb","\\`");// grave
defineSymbol(text$1,main,accent,"\u02c6","\\^");// circumflex
defineSymbol(text$1,main,accent,"\u02dc","\\~");// tilde
defineSymbol(text$1,main,accent,"\u02c9","\\=");// macron
defineSymbol(text$1,main,accent,"\u02d8","\\u");// breve
defineSymbol(text$1,main,accent,"\u02d9","\\.");// dot above
defineSymbol(text$1,main,accent,"\u02da","\\r");// ring above
defineSymbol(text$1,main,accent,"\u02c7","\\v");// caron
defineSymbol(text$1,main,accent,"\u00a8",'\\"');// diaresis
defineSymbol(text$1,main,accent,"\u02dd","\\H");// double acute
defineSymbol(text$1,main,accent,"\u25ef","\\textcircled");// \bigcirc glyph
// These ligatures are detected and created in Parser.js's `formLigatures`.
const ligatures={"--":true,"---":true,"``":true,"''":true};defineSymbol(text$1,main,textord,"\u2013","--");defineSymbol(text$1,main,textord,"\u2013","\\textendash");defineSymbol(text$1,main,textord,"\u2014","---");defineSymbol(text$1,main,textord,"\u2014","\\textemdash");defineSymbol(text$1,main,textord,"\u2018","`");defineSymbol(text$1,main,textord,"\u2018","\\textquoteleft");defineSymbol(text$1,main,textord,"\u2019","'");defineSymbol(text$1,main,textord,"\u2019","\\textquoteright");defineSymbol(text$1,main,textord,"\u201c","``");defineSymbol(text$1,main,textord,"\u201c","\\textquotedblleft");defineSymbol(text$1,main,textord,"\u201d","''");defineSymbol(text$1,main,textord,"\u201d","\\textquotedblright");//  \degree from gensymb package
defineSymbol(math,main,textord,"\u00b0","\\degree",true);defineSymbol(text$1,main,textord,"\u00b0","\\degree");// \textdegree from inputenc package
defineSymbol(text$1,main,textord,"\u00b0","\\textdegree",true);// TODO: In LaTeX, \pounds can generate a different character in text and math
// mode, but among our fonts, only Main-Italic defines this character "163".
defineSymbol(math,main,mathord,"\u00a3","\\pounds");defineSymbol(math,main,mathord,"\u00a3","\\mathsterling",true);defineSymbol(text$1,main,mathord,"\u00a3","\\pounds");defineSymbol(text$1,main,mathord,"\u00a3","\\textsterling",true);defineSymbol(math,ams,textord,"\u2720","\\maltese");defineSymbol(text$1,ams,textord,"\u2720","\\maltese");defineSymbol(text$1,main,spacing,"\u00a0","\\ ");defineSymbol(text$1,main,spacing,"\u00a0"," ");defineSymbol(text$1,main,spacing,"\u00a0","~");// There are lots of symbols which are the same, so we add them in afterwards.
// All of these are textords in math mode
const mathTextSymbols="0123456789/@.\"";for(let i=0;i<mathTextSymbols.length;i++){const ch=mathTextSymbols.charAt(i);defineSymbol(math,main,textord,ch,ch);}// All of these are textords in text mode
const textSymbols="0123456789!@*()-=+[]<>|\";:?/.,";for(let i=0;i<textSymbols.length;i++){const ch=textSymbols.charAt(i);defineSymbol(text$1,main,textord,ch,ch);}// All of these are textords in text mode, and mathords in math mode
const letters="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";for(let i=0;i<letters.length;i++){const ch=letters.charAt(i);defineSymbol(math,main,mathord,ch,ch);defineSymbol(text$1,main,textord,ch,ch);}// Blackboard bold and script letters in Unicode range
defineSymbol(math,ams,textord,"C","\u2102");// blackboard bold
defineSymbol(text$1,ams,textord,"C","\u2102");defineSymbol(math,ams,textord,"H","\u210D");defineSymbol(text$1,ams,textord,"H","\u210D");defineSymbol(math,ams,textord,"N","\u2115");defineSymbol(text$1,ams,textord,"N","\u2115");defineSymbol(math,ams,textord,"P","\u2119");defineSymbol(text$1,ams,textord,"P","\u2119");defineSymbol(math,ams,textord,"Q","\u211A");defineSymbol(text$1,ams,textord,"Q","\u211A");defineSymbol(math,ams,textord,"R","\u211D");defineSymbol(text$1,ams,textord,"R","\u211D");defineSymbol(math,ams,textord,"Z","\u2124");defineSymbol(text$1,ams,textord,"Z","\u2124");defineSymbol(math,main,mathord,"h","\u210E");// italic h, Planck constant
defineSymbol(text$1,main,mathord,"h","\u210E");// The next loop loads wide (surrogate pair) characters.
// We support some letters in the Unicode range U+1D400 to U+1D7FF,
// Mathematical Alphanumeric Symbols.
// Some editors do not deal well with wide characters. So don't write the
// string into this file. Instead, create the string from the surrogate pair.
let wideChar="";for(let i=0;i<letters.length;i++){const ch=letters.charAt(i);// The hex numbers in the next line are a surrogate pair.
// 0xD835 is the high surrogate for all letters in the range we support.
// 0xDC00 is the low surrogate for bold A.
wideChar=String.fromCharCode(0xD835,0xDC00+i);// A-Z a-z bold
defineSymbol(math,main,mathord,ch,wideChar);defineSymbol(text$1,main,textord,ch,wideChar);wideChar=String.fromCharCode(0xD835,0xDC34+i);// A-Z a-z italic
defineSymbol(math,main,mathord,ch,wideChar);defineSymbol(text$1,main,textord,ch,wideChar);wideChar=String.fromCharCode(0xD835,0xDC68+i);// A-Z a-z bold italic
defineSymbol(math,main,mathord,ch,wideChar);defineSymbol(text$1,main,textord,ch,wideChar);wideChar=String.fromCharCode(0xD835,0xDD04+i);// A-Z a-z Fractur
defineSymbol(math,main,mathord,ch,wideChar);defineSymbol(text$1,main,textord,ch,wideChar);wideChar=String.fromCharCode(0xD835,0xDDA0+i);// A-Z a-z sans-serif
defineSymbol(math,main,mathord,ch,wideChar);defineSymbol(text$1,main,textord,ch,wideChar);wideChar=String.fromCharCode(0xD835,0xDDD4+i);// A-Z a-z sans bold
defineSymbol(math,main,mathord,ch,wideChar);defineSymbol(text$1,main,textord,ch,wideChar);wideChar=String.fromCharCode(0xD835,0xDE08+i);// A-Z a-z sans italic
defineSymbol(math,main,mathord,ch,wideChar);defineSymbol(text$1,main,textord,ch,wideChar);wideChar=String.fromCharCode(0xD835,0xDE70+i);// A-Z a-z monospace
defineSymbol(math,main,mathord,ch,wideChar);defineSymbol(text$1,main,textord,ch,wideChar);if(i<26){// KaTeX fonts have only capital letters for blackboard bold and script.
// See exception for k below.
wideChar=String.fromCharCode(0xD835,0xDD38+i);// A-Z double struck
defineSymbol(math,main,mathord,ch,wideChar);defineSymbol(text$1,main,textord,ch,wideChar);wideChar=String.fromCharCode(0xD835,0xDC9C+i);// A-Z script
defineSymbol(math,main,mathord,ch,wideChar);defineSymbol(text$1,main,textord,ch,wideChar);}// TODO: Add bold script when it is supported by a KaTeX font.
}// "k" is the only double struck lower case letter in the KaTeX fonts.
wideChar=String.fromCharCode(0xD835,0xDD5C);// k double struck
defineSymbol(math,main,mathord,"k",wideChar);defineSymbol(text$1,main,textord,"k",wideChar);// Next, some wide character numerals
for(let i=0;i<10;i++){const ch=i.toString();wideChar=String.fromCharCode(0xD835,0xDFCE+i);// 0-9 bold
defineSymbol(math,main,mathord,ch,wideChar);defineSymbol(text$1,main,textord,ch,wideChar);wideChar=String.fromCharCode(0xD835,0xDFE2+i);// 0-9 sans serif
defineSymbol(math,main,mathord,ch,wideChar);defineSymbol(text$1,main,textord,ch,wideChar);wideChar=String.fromCharCode(0xD835,0xDFEC+i);// 0-9 bold sans
defineSymbol(math,main,mathord,ch,wideChar);defineSymbol(text$1,main,textord,ch,wideChar);wideChar=String.fromCharCode(0xD835,0xDFF6+i);// 0-9 monospace
defineSymbol(math,main,mathord,ch,wideChar);defineSymbol(text$1,main,textord,ch,wideChar);}// We add these Latin-1 letters as symbols for backwards-compatibility,
// but they are not actually in the font, nor are they supported by the
// Unicode accent mechanism, so they fall back to Times font and look ugly.
// TODO(edemaine): Fix this.
const extraLatin="ÇÐÞçþ";for(let i=0;i<extraLatin.length;i++){const ch=extraLatin.charAt(i);defineSymbol(math,main,mathord,ch,ch);defineSymbol(text$1,main,textord,ch,ch);}defineSymbol(text$1,main,textord,"ð","ð");// Unicode versions of existing characters
defineSymbol(text$1,main,textord,"\u2013","–");defineSymbol(text$1,main,textord,"\u2014","—");defineSymbol(text$1,main,textord,"\u2018","‘");defineSymbol(text$1,main,textord,"\u2019","’");defineSymbol(text$1,main,textord,"\u201c","“");defineSymbol(text$1,main,textord,"\u201d","”");/**
 * This file provides support for Unicode range U+1D400 to U+1D7FF,
 * Mathematical Alphanumeric Symbols.
 *
 * Function wideCharacterFont takes a wide character as input and returns
 * the font information necessary to render it properly.
 */ /**
 * Data below is from https://www.unicode.org/charts/PDF/U1D400.pdf
 * That document sorts characters into groups by font type, say bold or italic.
 *
 * In the arrays below, each subarray consists three elements:
 *      * The CSS class of that group when in math mode.
 *      * The CSS class of that group when in text mode.
 *      * The font name, so that KaTeX can get font metrics.
 */const wideLatinLetterData=[["mathbf","textbf","Main-Bold"],// A-Z bold upright
["mathbf","textbf","Main-Bold"],// a-z bold upright
["mathdefault","textit","Math-Italic"],// A-Z italic
["mathdefault","textit","Math-Italic"],// a-z italic
["boldsymbol","boldsymbol","Main-BoldItalic"],// A-Z bold italic
["boldsymbol","boldsymbol","Main-BoldItalic"],// a-z bold italic
// Map fancy A-Z letters to script, not calligraphic.
// This aligns with unicode-math and math fonts (except Cambria Math).
["mathscr","textscr","Script-Regular"],// A-Z script
["","",""],// a-z script.  No font
["","",""],// A-Z bold script. No font
["","",""],// a-z bold script. No font
["mathfrak","textfrak","Fraktur-Regular"],// A-Z Fraktur
["mathfrak","textfrak","Fraktur-Regular"],// a-z Fraktur
["mathbb","textbb","AMS-Regular"],// A-Z double-struck
["mathbb","textbb","AMS-Regular"],// k double-struck
["","",""],// A-Z bold Fraktur No font metrics
["","",""],// a-z bold Fraktur.   No font.
["mathsf","textsf","SansSerif-Regular"],// A-Z sans-serif
["mathsf","textsf","SansSerif-Regular"],// a-z sans-serif
["mathboldsf","textboldsf","SansSerif-Bold"],// A-Z bold sans-serif
["mathboldsf","textboldsf","SansSerif-Bold"],// a-z bold sans-serif
["mathitsf","textitsf","SansSerif-Italic"],// A-Z italic sans-serif
["mathitsf","textitsf","SansSerif-Italic"],// a-z italic sans-serif
["","",""],// A-Z bold italic sans. No font
["","",""],// a-z bold italic sans. No font
["mathtt","texttt","Typewriter-Regular"],// A-Z monospace
["mathtt","texttt","Typewriter-Regular"]];const wideNumeralData=[["mathbf","textbf","Main-Bold"],// 0-9 bold
["","",""],// 0-9 double-struck. No KaTeX font.
["mathsf","textsf","SansSerif-Regular"],// 0-9 sans-serif
["mathboldsf","textboldsf","SansSerif-Bold"],// 0-9 bold sans-serif
["mathtt","texttt","Typewriter-Regular"]];const wideCharacterFont=function wideCharacterFont(wideChar,mode){// IE doesn't support codePointAt(). So work with the surrogate pair.
const H=wideChar.charCodeAt(0);// high surrogate
const L=wideChar.charCodeAt(1);// low surrogate
const codePoint=(H-0xD800)*0x400+(L-0xDC00)+0x10000;const j=mode==="math"?0:1;// column index for CSS class.
if(0x1D400<=codePoint&&codePoint<0x1D6A4){// wideLatinLetterData contains exactly 26 chars on each row.
// So we can calculate the relevant row. No traverse necessary.
const i=Math.floor((codePoint-0x1D400)/26);return [wideLatinLetterData[i][2],wideLatinLetterData[i][j]];}else if(0x1D7CE<=codePoint&&codePoint<=0x1D7FF){// Numerals, ten per row.
const i=Math.floor((codePoint-0x1D7CE)/10);return [wideNumeralData[i][2],wideNumeralData[i][j]];}else if(codePoint===0x1D6A5||codePoint===0x1D6A6){// dotless i or j
return [wideLatinLetterData[0][2],wideLatinLetterData[0][j]];}else if(0x1D6A6<codePoint&&codePoint<0x1D7CE){// Greek letters. Not supported, yet.
return ["",""];}else{// We don't support any wide characters outside 1D400–1D7FF.
throw new ParseError("Unsupported character: "+wideChar);}};/**
 * This file contains information about the options that the Parser carries
 * around with it while parsing. Data is held in an `Options` object, and when
 * recursing, a new `Options` object can be created with the `.with*` and
 * `.reset` functions.
 */const sizeStyleMap=[// Each element contains [textsize, scriptsize, scriptscriptsize].
// The size mappings are taken from TeX with \normalsize=10pt.
[1,1,1],// size1: [5, 5, 5]              \tiny
[2,1,1],// size2: [6, 5, 5]
[3,1,1],// size3: [7, 5, 5]              \scriptsize
[4,2,1],// size4: [8, 6, 5]              \footnotesize
[5,2,1],// size5: [9, 6, 5]              \small
[6,3,1],// size6: [10, 7, 5]             \normalsize
[7,4,2],// size7: [12, 8, 6]             \large
[8,6,3],// size8: [14.4, 10, 7]          \Large
[9,7,6],// size9: [17.28, 12, 10]        \LARGE
[10,8,7],// size10: [20.74, 14.4, 12]     \huge
[11,10,9]];const sizeMultipliers=[// fontMetrics.js:getGlobalMetrics also uses size indexes, so if
// you change size indexes, change that function.
0.5,0.6,0.7,0.8,0.9,1.0,1.2,1.44,1.728,2.074,2.488];const sizeAtStyle=function sizeAtStyle(size,style){return style.size<2?size:sizeStyleMap[size-1][style.size-1];};/**
 * This is the main options class. It contains the current style, size, color,
 * and font.
 *
 * Options objects should not be modified. To create a new Options with
 * different properties, call a `.having*` method.
 */class Options{// A font family applies to a group of fonts (i.e. SansSerif), while a font
// represents a specific font (i.e. SansSerif Bold).
// See: https://tex.stackexchange.com/questions/22350/difference-between-textrm-and-mathrm
/**
   * The base size index.
   */constructor(data){this.style=void 0;this.color=void 0;this.size=void 0;this.textSize=void 0;this.phantom=void 0;this.font=void 0;this.fontFamily=void 0;this.fontWeight=void 0;this.fontShape=void 0;this.sizeMultiplier=void 0;this.maxSize=void 0;this._fontMetrics=void 0;this.style=data.style;this.color=data.color;this.size=data.size||Options.BASESIZE;this.textSize=data.textSize||this.size;this.phantom=!!data.phantom;this.font=data.font||"";this.fontFamily=data.fontFamily||"";this.fontWeight=data.fontWeight||'';this.fontShape=data.fontShape||'';this.sizeMultiplier=sizeMultipliers[this.size-1];this.maxSize=data.maxSize;this._fontMetrics=undefined;}/**
   * Returns a new options object with the same properties as "this".  Properties
   * from "extension" will be copied to the new options object.
   */extend(extension){const data={style:this.style,size:this.size,textSize:this.textSize,color:this.color,phantom:this.phantom,font:this.font,fontFamily:this.fontFamily,fontWeight:this.fontWeight,fontShape:this.fontShape,maxSize:this.maxSize};for(const key in extension){if(extension.hasOwnProperty(key)){data[key]=extension[key];}}return new Options(data);}/**
   * Return an options object with the given style. If `this.style === style`,
   * returns `this`.
   */havingStyle(style){if(this.style===style){return this;}else{return this.extend({style:style,size:sizeAtStyle(this.textSize,style)});}}/**
   * Return an options object with a cramped version of the current style. If
   * the current style is cramped, returns `this`.
   */havingCrampedStyle(){return this.havingStyle(this.style.cramp());}/**
   * Return an options object with the given size and in at least `\textstyle`.
   * Returns `this` if appropriate.
   */havingSize(size){if(this.size===size&&this.textSize===size){return this;}else{return this.extend({style:this.style.text(),size:size,textSize:size,sizeMultiplier:sizeMultipliers[size-1]});}}/**
   * Like `this.havingSize(BASESIZE).havingStyle(style)`. If `style` is omitted,
   * changes to at least `\textstyle`.
   */havingBaseStyle(style){style=style||this.style.text();const wantSize=sizeAtStyle(Options.BASESIZE,style);if(this.size===wantSize&&this.textSize===Options.BASESIZE&&this.style===style){return this;}else{return this.extend({style:style,size:wantSize});}}/**
   * Remove the effect of sizing changes such as \Huge.
   * Keep the effect of the current style, such as \scriptstyle.
   */havingBaseSizing(){let size;switch(this.style.id){case 4:case 5:size=3;// normalsize in scriptstyle
break;case 6:case 7:size=1;// normalsize in scriptscriptstyle
break;default:size=6;// normalsize in textstyle or displaystyle
}return this.extend({style:this.style.text(),size:size});}/**
   * Create a new options object with the given color.
   */withColor(color){return this.extend({color:color});}/**
   * Create a new options object with "phantom" set to true.
   */withPhantom(){return this.extend({phantom:true});}/**
   * Creates a new options object with the given math font or old text font.
   * @type {[type]}
   */withFont(font){return this.extend({font});}/**
   * Create a new options objects with the given fontFamily.
   */withTextFontFamily(fontFamily){return this.extend({fontFamily,font:""});}/**
   * Creates a new options object with the given font weight
   */withTextFontWeight(fontWeight){return this.extend({fontWeight,font:""});}/**
   * Creates a new options object with the given font weight
   */withTextFontShape(fontShape){return this.extend({fontShape,font:""});}/**
   * Return the CSS sizing classes required to switch from enclosing options
   * `oldOptions` to `this`. Returns an array of classes.
   */sizingClasses(oldOptions){if(oldOptions.size!==this.size){return ["sizing","reset-size"+oldOptions.size,"size"+this.size];}else{return [];}}/**
   * Return the CSS sizing classes required to switch to the base size. Like
   * `this.havingSize(BASESIZE).sizingClasses(this)`.
   */baseSizingClasses(){if(this.size!==Options.BASESIZE){return ["sizing","reset-size"+this.size,"size"+Options.BASESIZE];}else{return [];}}/**
   * Return the font metrics for this size.
   */fontMetrics(){if(!this._fontMetrics){this._fontMetrics=getGlobalMetrics(this.size);}return this._fontMetrics;}/**
   * A map of color names to CSS colors.
   * TODO(emily): Remove this when we have real macros
   */ /**
   * Gets the CSS color of the current options object, accounting for the
   * `colorMap`.
   */getColor(){if(this.phantom){return "transparent";}else if(this.color!=null&&Options.colorMap.hasOwnProperty(this.color)){return Options.colorMap[this.color];}else{return this.color;}}}Options.BASESIZE=6;Options.colorMap={"katex-blue":"#6495ed","katex-orange":"#ffa500","katex-pink":"#ff00af","katex-red":"#df0030","katex-green":"#28ae7b","katex-gray":"gray","katex-purple":"#9d38bd","katex-blueA":"#ccfaff","katex-blueB":"#80f6ff","katex-blueC":"#63d9ea","katex-blueD":"#11accd","katex-blueE":"#0c7f99","katex-tealA":"#94fff5","katex-tealB":"#26edd5","katex-tealC":"#01d1c1","katex-tealD":"#01a995","katex-tealE":"#208170","katex-greenA":"#b6ffb0","katex-greenB":"#8af281","katex-greenC":"#74cf70","katex-greenD":"#1fab54","katex-greenE":"#0d923f","katex-goldA":"#ffd0a9","katex-goldB":"#ffbb71","katex-goldC":"#ff9c39","katex-goldD":"#e07d10","katex-goldE":"#a75a05","katex-redA":"#fca9a9","katex-redB":"#ff8482","katex-redC":"#f9685d","katex-redD":"#e84d39","katex-redE":"#bc2612","katex-maroonA":"#ffbde0","katex-maroonB":"#ff92c6","katex-maroonC":"#ed5fa6","katex-maroonD":"#ca337c","katex-maroonE":"#9e034e","katex-purpleA":"#ddd7ff","katex-purpleB":"#c6b9fc","katex-purpleC":"#aa87ff","katex-purpleD":"#7854ab","katex-purpleE":"#543b78","katex-mintA":"#f5f9e8","katex-mintB":"#edf2df","katex-mintC":"#e0e5cc","katex-grayA":"#f6f7f7","katex-grayB":"#f0f1f2","katex-grayC":"#e3e5e6","katex-grayD":"#d6d8da","katex-grayE":"#babec2","katex-grayF":"#888d93","katex-grayG":"#626569","katex-grayH":"#3b3e40","katex-grayI":"#21242c","katex-kaBlue":"#314453","katex-kaGreen":"#71B307"};/**
 * This file does conversion between units.  In particular, it provides
 * calculateSize to convert other units into ems.
 */ // Thus, multiplying a length by this number converts the length from units
// into pts.  Dividing the result by ptPerEm gives the number of ems
// *assuming* a font size of ptPerEm (normal size, normal style).
const ptPerUnit={// https://en.wikibooks.org/wiki/LaTeX/Lengths and
// https://tex.stackexchange.com/a/8263
"pt":1,// TeX point
"mm":7227/2540,// millimeter
"cm":7227/254,// centimeter
"in":72.27,// inch
"bp":803/800,// big (PostScript) points
"pc":12,// pica
"dd":1238/1157,// didot
"cc":14856/1157,// cicero (12 didot)
"nd":685/642,// new didot
"nc":1370/107,// new cicero (12 new didot)
"sp":1/65536,// scaled point (TeX's internal smallest unit)
// https://tex.stackexchange.com/a/41371
"px":803/800// \pdfpxdimen defaults to 1 bp in pdfTeX and LuaTeX
};// Dictionary of relative units, for fast validity testing.
const relativeUnit={"ex":true,"em":true,"mu":true};/**
 * Determine whether the specified unit (either a string defining the unit
 * or a "size" parse node containing a unit field) is valid.
 */const validUnit=function validUnit(unit){if(typeof unit!=="string"){unit=unit.unit;}return unit in ptPerUnit||unit in relativeUnit||unit==="ex";};/*
 * Convert a "size" parse node (with numeric "number" and string "unit" fields,
 * as parsed by functions.js argType "size") into a CSS em value for the
 * current style/scale.  `options` gives the current options.
 */const calculateSize=function calculateSize(sizeValue,options){let scale;if(sizeValue.unit in ptPerUnit){// Absolute units
scale=ptPerUnit[sizeValue.unit]// Convert unit to pt
/options.fontMetrics().ptPerEm// Convert pt to CSS em
/options.sizeMultiplier;// Unscale to make absolute units
}else if(sizeValue.unit==="mu"){// `mu` units scale with scriptstyle/scriptscriptstyle.
scale=options.fontMetrics().cssEmPerMu;}else{// Other relative units always refer to the *textstyle* font
// in the current size.
let unitOptions;if(options.style.isTight()){// isTight() means current style is script/scriptscript.
unitOptions=options.havingStyle(options.style.text());}else{unitOptions=options;}// TODO: In TeX these units are relative to the quad of the current
// *text* font, e.g. cmr10. KaTeX instead uses values from the
// comparably-sized *Computer Modern symbol* font. At 10pt, these
// match. At 7pt and 5pt, they differ: cmr7=1.138894, cmsy7=1.170641;
// cmr5=1.361133, cmsy5=1.472241. Consider $\scriptsize a\kern1emb$.
// TeX \showlists shows a kern of 1.13889 * fontsize;
// KaTeX shows a kern of 1.171 * fontsize.
if(sizeValue.unit==="ex"){scale=unitOptions.fontMetrics().xHeight;}else if(sizeValue.unit==="em"){scale=unitOptions.fontMetrics().quad;}else{throw new ParseError("Invalid unit: '"+sizeValue.unit+"'");}if(unitOptions!==options){scale*=unitOptions.sizeMultiplier/options.sizeMultiplier;}}return Math.min(sizeValue.number*scale,options.maxSize);};/* eslint no-console:0 */ // The following have to be loaded from Main-Italic font, using class mathit
const mathitLetters=["\\imath","ı",// dotless i
"\\jmath","ȷ",// dotless j
"\\pounds","\\mathsterling","\\textsterling","£"];/**
 * Looks up the given symbol in fontMetrics, after applying any symbol
 * replacements defined in symbol.js
 */const lookupSymbol=function lookupSymbol(value,// TODO(#963): Use a union type for this.
fontName,mode){// Replace the value with its replaced value from symbol.js
if(symbols[mode][value]&&symbols[mode][value].replace){value=symbols[mode][value].replace;}return {value:value,metrics:getCharacterMetrics(value,fontName,mode)};};/**
 * Makes a symbolNode after translation via the list of symbols in symbols.js.
 * Correctly pulls out metrics for the character, and optionally takes a list of
 * classes to be attached to the node.
 *
 * TODO: make argument order closer to makeSpan
 * TODO: add a separate argument for math class (e.g. `mop`, `mbin`), which
 * should if present come first in `classes`.
 * TODO(#953): Make `options` mandatory and always pass it in.
 */const makeSymbol=function makeSymbol(value,fontName,mode,options,classes){const lookup=lookupSymbol(value,fontName,mode);const metrics=lookup.metrics;value=lookup.value;let symbolNode;if(metrics){let italic=metrics.italic;if(mode==="text"||options&&options.font==="mathit"){italic=0;}symbolNode=new SymbolNode(value,metrics.height,metrics.depth,italic,metrics.skew,metrics.width,classes);}else{// TODO(emily): Figure out a good way to only print this in development
typeof console!=="undefined"&&console.warn("No character metrics for '"+value+"' in style '"+fontName+"'");symbolNode=new SymbolNode(value,0,0,0,0,0,classes);}if(options){symbolNode.maxFontSize=options.sizeMultiplier;if(options.style.isTight()){symbolNode.classes.push("mtight");}const color=options.getColor();if(color){symbolNode.style.color=color;}}return symbolNode;};/**
 * Makes a symbol in Main-Regular or AMS-Regular.
 * Used for rel, bin, open, close, inner, and punct.
 *
 * TODO(#953): Make `options` mandatory and always pass it in.
 */const mathsym=function mathsym(value,mode,options,classes){if(classes===void 0){classes=[];}// Decide what font to render the symbol in by its entry in the symbols
// table.
// Have a special case for when the value = \ because the \ is used as a
// textord in unsupported command errors but cannot be parsed as a regular
// text ordinal and is therefore not present as a symbol in the symbols
// table for text, as well as a special case for boldsymbol because it
// can be used for bold + and -
if(options&&options.font&&options.font==="boldsymbol"&&lookupSymbol(value,"Main-Bold",mode).metrics){return makeSymbol(value,"Main-Bold",mode,options,classes.concat(["mathbf"]));}else if(value==="\\"||symbols[mode][value].font==="main"){return makeSymbol(value,"Main-Regular",mode,options,classes);}else{return makeSymbol(value,"AMS-Regular",mode,options,classes.concat(["amsrm"]));}};/**
 * Determines which of the two font names (Main-Italic and Math-Italic) and
 * corresponding style tags (maindefault or mathit) to use for default math font,
 * depending on the symbol.
 */const mathdefault=function mathdefault(value,mode,options,classes){if(/[0-9]/.test(value.charAt(0))||// glyphs for \imath and \jmath do not exist in Math-Italic so we
// need to use Main-Italic instead
utils.contains(mathitLetters,value)){return {fontName:"Main-Italic",fontClass:"mathit"};}else{return {fontName:"Math-Italic",fontClass:"mathdefault"};}};/**
 * Determines which of the font names (Main-Italic, Math-Italic, and Caligraphic)
 * and corresponding style tags (mathit, mathdefault, or mathcal) to use for font
 * "mathnormal", depending on the symbol.  Use this function instead of fontMap for
 * font "mathnormal".
 */const mathnormal=function mathnormal(value,mode,options,classes){if(utils.contains(mathitLetters,value)){return {fontName:"Main-Italic",fontClass:"mathit"};}else if(/[0-9]/.test(value.charAt(0))){return {fontName:"Caligraphic-Regular",fontClass:"mathcal"};}else{return {fontName:"Math-Italic",fontClass:"mathdefault"};}};/**
 * Determines which of the two font names (Main-Bold and Math-BoldItalic) and
 * corresponding style tags (mathbf or boldsymbol) to use for font "boldsymbol",
 * depending on the symbol.  Use this function instead of fontMap for font
 * "boldsymbol".
 */const boldsymbol=function boldsymbol(value,mode,options,classes){if(lookupSymbol(value,"Math-BoldItalic",mode).metrics){return {fontName:"Math-BoldItalic",fontClass:"boldsymbol"};}else{// Some glyphs do not exist in Math-BoldItalic so we need to use
// Main-Bold instead.
return {fontName:"Main-Bold",fontClass:"mathbf"};}};/**
 * Makes either a mathord or textord in the correct font and color.
 */const makeOrd=function makeOrd(group,options,type){const mode=group.mode;const text=group.text;const classes=["mord"];// Math mode or Old font (i.e. \rm)
const isFont=mode==="math"||mode==="text"&&options.font;const fontOrFamily=isFont?options.font:options.fontFamily;if(text.charCodeAt(0)===0xD835){// surrogate pairs get special treatment
const _wideCharacterFont=wideCharacterFont(text,mode),wideFontName=_wideCharacterFont[0],wideFontClass=_wideCharacterFont[1];return makeSymbol(text,wideFontName,mode,options,classes.concat(wideFontClass));}else if(fontOrFamily){let fontName;let fontClasses;if(fontOrFamily==="boldsymbol"||fontOrFamily==="mathnormal"){const fontData=fontOrFamily==="boldsymbol"?boldsymbol(text,mode):mathnormal(text);fontName=fontData.fontName;fontClasses=[fontData.fontClass];}else if(utils.contains(mathitLetters,text)){fontName="Main-Italic";fontClasses=["mathit"];}else if(isFont){fontName=fontMap[fontOrFamily].fontName;fontClasses=[fontOrFamily];}else{fontName=retrieveTextFontName(fontOrFamily,options.fontWeight,options.fontShape);fontClasses=[fontOrFamily,options.fontWeight,options.fontShape];}if(lookupSymbol(text,fontName,mode).metrics){return makeSymbol(text,fontName,mode,options,classes.concat(fontClasses));}else if(ligatures.hasOwnProperty(text)&&fontName.substr(0,10)==="Typewriter"){// Deconstruct ligatures in monospace fonts (\texttt, \tt).
const parts=[];for(let i=0;i<text.length;i++){parts.push(makeSymbol(text[i],fontName,mode,options,classes.concat(fontClasses)));}return makeFragment(parts);}}// Makes a symbol in the default font for mathords and textords.
if(type==="mathord"){const fontLookup=mathdefault(text);return makeSymbol(text,fontLookup.fontName,mode,options,classes.concat([fontLookup.fontClass]));}else if(type==="textord"){const font=symbols[mode][text]&&symbols[mode][text].font;if(font==="ams"){const fontName=retrieveTextFontName("amsrm",options.fontWeight,options.fontShape);return makeSymbol(text,fontName,mode,options,classes.concat("amsrm",options.fontWeight,options.fontShape));}else if(font==="main"||!font){const fontName=retrieveTextFontName("textrm",options.fontWeight,options.fontShape);return makeSymbol(text,fontName,mode,options,classes.concat(options.fontWeight,options.fontShape));}else{// fonts added by plugins
const fontName=retrieveTextFontName(font,options.fontWeight,options.fontShape);// We add font name as a css class
return makeSymbol(text,fontName,mode,options,classes.concat(fontName,options.fontWeight,options.fontShape));}}else{throw new Error("unexpected type: "+type+" in makeOrd");}};/**
 * Returns true if subsequent symbolNodes have the same classes, skew, maxFont,
 * and styles.
 */const canCombine=(prev,next)=>{if(createClass(prev.classes)!==createClass(next.classes)||prev.skew!==next.skew||prev.maxFontSize!==next.maxFontSize){return false;}for(const style in prev.style){if(prev.style.hasOwnProperty(style)&&prev.style[style]!==next.style[style]){return false;}}for(const style in next.style){if(next.style.hasOwnProperty(style)&&prev.style[style]!==next.style[style]){return false;}}return true;};/**
 * Combine consequetive domTree.symbolNodes into a single symbolNode.
 * Note: this function mutates the argument.
 */const tryCombineChars=chars=>{for(let i=0;i<chars.length-1;i++){const prev=chars[i];const next=chars[i+1];if(prev instanceof SymbolNode&&next instanceof SymbolNode&&canCombine(prev,next)){prev.text+=next.text;prev.height=Math.max(prev.height,next.height);prev.depth=Math.max(prev.depth,next.depth);// Use the last character's italic correction since we use
// it to add padding to the right of the span created from
// the combined characters.
prev.italic=next.italic;chars.splice(i+1,1);i--;}}return chars;};/**
 * Calculate the height, depth, and maxFontSize of an element based on its
 * children.
 */const sizeElementFromChildren=function sizeElementFromChildren(elem){let height=0;let depth=0;let maxFontSize=0;for(let i=0;i<elem.children.length;i++){const child=elem.children[i];if(child.height>height){height=child.height;}if(child.depth>depth){depth=child.depth;}if(child.maxFontSize>maxFontSize){maxFontSize=child.maxFontSize;}}elem.height=height;elem.depth=depth;elem.maxFontSize=maxFontSize;};/**
 * Makes a span with the given list of classes, list of children, and options.
 *
 * TODO(#953): Ensure that `options` is always provided (currently some call
 * sites don't pass it) and make the type below mandatory.
 * TODO: add a separate argument for math class (e.g. `mop`, `mbin`), which
 * should if present come first in `classes`.
 */const makeSpan=function makeSpan(classes,children,options,style){const span=new Span(classes,children,options,style);sizeElementFromChildren(span);return span;};// SVG one is simpler -- doesn't require height, depth, max-font setting.
// This is also a separate method for typesafety.
const makeSvgSpan=(classes,children,options,style)=>new Span(classes,children,options,style);const makeLineSpan=function makeLineSpan(className,options,thickness){const line=makeSpan([className],[],options);line.height=thickness||options.fontMetrics().defaultRuleThickness;line.style.borderBottomWidth=line.height+"em";line.maxFontSize=1.0;return line;};/**
 * Makes an anchor with the given href, list of classes, list of children,
 * and options.
 */const makeAnchor=function makeAnchor(href,classes,children,options){const anchor=new Anchor(href,classes,children,options);sizeElementFromChildren(anchor);return anchor;};/**
 * Makes a document fragment with the given list of children.
 */const makeFragment=function makeFragment(children){const fragment=new DocumentFragment(children);sizeElementFromChildren(fragment);return fragment;};/**
 * Wraps group in a span if it's a document fragment, allowing to apply classes
 * and styles
 */const wrapFragment=function wrapFragment(group,options){if(group instanceof DocumentFragment){return makeSpan([],[group],options);}return group;};// These are exact object types to catch typos in the names of the optional fields.
// Computes the updated `children` list and the overall depth.
//
// This helper function for makeVList makes it easier to enforce type safety by
// allowing early exits (returns) in the logic.
const getVListChildrenAndDepth=function getVListChildrenAndDepth(params){if(params.positionType==="individualShift"){const oldChildren=params.children;const children=[oldChildren[0]];// Add in kerns to the list of params.children to get each element to be
// shifted to the correct specified shift
const depth=-oldChildren[0].shift-oldChildren[0].elem.depth;let currPos=depth;for(let i=1;i<oldChildren.length;i++){const diff=-oldChildren[i].shift-currPos-oldChildren[i].elem.depth;const size=diff-(oldChildren[i-1].elem.height+oldChildren[i-1].elem.depth);currPos=currPos+diff;children.push({type:"kern",size});children.push(oldChildren[i]);}return {children,depth};}let depth;if(params.positionType==="top"){// We always start at the bottom, so calculate the bottom by adding up
// all the sizes
let bottom=params.positionData;for(let i=0;i<params.children.length;i++){const child=params.children[i];bottom-=child.type==="kern"?child.size:child.elem.height+child.elem.depth;}depth=bottom;}else if(params.positionType==="bottom"){depth=-params.positionData;}else{const firstChild=params.children[0];if(firstChild.type!=="elem"){throw new Error('First child must have type "elem".');}if(params.positionType==="shift"){depth=-firstChild.elem.depth-params.positionData;}else if(params.positionType==="firstBaseline"){depth=-firstChild.elem.depth;}else{throw new Error(`Invalid positionType ${params.positionType}.`);}}return {children:params.children,depth};};/**
 * Makes a vertical list by stacking elements and kerns on top of each other.
 * Allows for many different ways of specifying the positioning method.
 *
 * See VListParam documentation above.
 */const makeVList=function makeVList(params,options){const _getVListChildrenAndD=getVListChildrenAndDepth(params),children=_getVListChildrenAndD.children,depth=_getVListChildrenAndD.depth;// Create a strut that is taller than any list item. The strut is added to
// each item, where it will determine the item's baseline. Since it has
// `overflow:hidden`, the strut's top edge will sit on the item's line box's
// top edge and the strut's bottom edge will sit on the item's baseline,
// with no additional line-height spacing. This allows the item baseline to
// be positioned precisely without worrying about font ascent and
// line-height.
let pstrutSize=0;for(let i=0;i<children.length;i++){const child=children[i];if(child.type==="elem"){const elem=child.elem;pstrutSize=Math.max(pstrutSize,elem.maxFontSize,elem.height);}}pstrutSize+=2;const pstrut=makeSpan(["pstrut"],[]);pstrut.style.height=pstrutSize+"em";// Create a new list of actual children at the correct offsets
const realChildren=[];let minPos=depth;let maxPos=depth;let currPos=depth;for(let i=0;i<children.length;i++){const child=children[i];if(child.type==="kern"){currPos+=child.size;}else{const elem=child.elem;const classes=child.wrapperClasses||[];const style=child.wrapperStyle||{};const childWrap=makeSpan(classes,[pstrut,elem],undefined,style);childWrap.style.top=-pstrutSize-currPos-elem.depth+"em";if(child.marginLeft){childWrap.style.marginLeft=child.marginLeft;}if(child.marginRight){childWrap.style.marginRight=child.marginRight;}realChildren.push(childWrap);currPos+=elem.height+elem.depth;}minPos=Math.min(minPos,currPos);maxPos=Math.max(maxPos,currPos);}// The vlist contents go in a table-cell with `vertical-align:bottom`.
// This cell's bottom edge will determine the containing table's baseline
// without overly expanding the containing line-box.
const vlist=makeSpan(["vlist"],realChildren);vlist.style.height=maxPos+"em";// A second row is used if necessary to represent the vlist's depth.
let rows;if(minPos<0){// We will define depth in an empty span with display: table-cell.
// It should render with the height that we define. But Chrome, in
// contenteditable mode only, treats that span as if it contains some
// text content. And that min-height over-rides our desired height.
// So we put another empty span inside the depth strut span.
const emptySpan=makeSpan([],[]);const depthStrut=makeSpan(["vlist"],[emptySpan]);depthStrut.style.height=-minPos+"em";// Safari wants the first row to have inline content; otherwise it
// puts the bottom of the *second* row on the baseline.
const topStrut=makeSpan(["vlist-s"],[new SymbolNode("\u200b")]);rows=[makeSpan(["vlist-r"],[vlist,topStrut]),makeSpan(["vlist-r"],[depthStrut])];}else{rows=[makeSpan(["vlist-r"],[vlist])];}const vtable=makeSpan(["vlist-t"],rows);if(rows.length===2){vtable.classes.push("vlist-t2");}vtable.height=maxPos;vtable.depth=-minPos;return vtable;};// Glue is a concept from TeX which is a flexible space between elements in
// either a vertical or horizontal list. In KaTeX, at least for now, it's
// static space between elements in a horizontal layout.
const makeGlue=(measurement,options)=>{// Make an empty span for the space
const rule=makeSpan(["mspace"],[],options);const size=calculateSize(measurement,options);rule.style.marginRight=`${size}em`;return rule;};// Takes font options, and returns the appropriate fontLookup name
const retrieveTextFontName=function retrieveTextFontName(fontFamily,fontWeight,fontShape){let baseFontName="";switch(fontFamily){case"amsrm":baseFontName="AMS";break;case"textrm":baseFontName="Main";break;case"textsf":baseFontName="SansSerif";break;case"texttt":baseFontName="Typewriter";break;default:baseFontName=fontFamily;// use fonts added by a plugin
}let fontStylesName;if(fontWeight==="textbf"&&fontShape==="textit"){fontStylesName="BoldItalic";}else if(fontWeight==="textbf"){fontStylesName="Bold";}else if(fontWeight==="textit"){fontStylesName="Italic";}else{fontStylesName="Regular";}return `${baseFontName}-${fontStylesName}`;};/**
 * Maps TeX font commands to objects containing:
 * - variant: string used for "mathvariant" attribute in buildMathML.js
 * - fontName: the "style" parameter to fontMetrics.getCharacterMetrics
 */ // A map between tex font commands an MathML mathvariant attribute values
const fontMap={// styles
"mathbf":{variant:"bold",fontName:"Main-Bold"},"mathrm":{variant:"normal",fontName:"Main-Regular"},"textit":{variant:"italic",fontName:"Main-Italic"},"mathit":{variant:"italic",fontName:"Main-Italic"},// Default math font, "mathnormal" and "boldsymbol" are missing because they
// require the use of several fonts: Main-Italic and Math-Italic for default
// math font, Main-Italic, Math-Italic, Caligraphic for "mathnormal", and
// Math-BoldItalic and Main-Bold for "boldsymbol".  This is handled by a
// special case in makeOrd which ends up calling mathdefault, mathnormal,
// and boldsymbol.
// families
"mathbb":{variant:"double-struck",fontName:"AMS-Regular"},"mathcal":{variant:"script",fontName:"Caligraphic-Regular"},"mathfrak":{variant:"fraktur",fontName:"Fraktur-Regular"},"mathscr":{variant:"script",fontName:"Script-Regular"},"mathsf":{variant:"sans-serif",fontName:"SansSerif-Regular"},"mathtt":{variant:"monospace",fontName:"Typewriter-Regular"}};const svgData={//   path, width, height
vec:["vec",0.471,0.714],// values from the font glyph
oiintSize1:["oiintSize1",0.957,0.499],// oval to overlay the integrand
oiintSize2:["oiintSize2",1.472,0.659],oiiintSize1:["oiiintSize1",1.304,0.499],oiiintSize2:["oiiintSize2",1.98,0.659]};const staticSvg=function staticSvg(value,options){// Create a span with inline SVG for the element.
const _svgData$value=svgData[value],pathName=_svgData$value[0],width=_svgData$value[1],height=_svgData$value[2];const path=new PathNode(pathName);const svgNode=new SvgNode([path],{"width":width+"em","height":height+"em",// Override CSS rule `.katex svg { width: 100% }`
"style":"width:"+width+"em","viewBox":"0 0 "+1000*width+" "+1000*height,"preserveAspectRatio":"xMinYMin"});const span=makeSvgSpan(["overlay"],[svgNode],options);span.height=height;span.style.height=height+"em";span.style.width=width+"em";return span;};var buildCommon={fontMap,makeSymbol,mathsym,makeSpan,makeSvgSpan,makeLineSpan,makeAnchor,makeFragment,wrapFragment,makeVList,makeOrd,makeGlue,staticSvg,svgData,tryCombineChars};/**
 * Asserts that the node is of the given type and returns it with stricter
 * typing. Throws if the node's type does not match.
 */function assertNodeType(node,type){const typedNode=checkNodeType(node,type);if(!typedNode){throw new Error(`Expected node of type ${type}, but got `+(node?`node of type ${node.type}`:String(node)));}// $FlowFixMe: Unsure why.
return typedNode;}/**
 * Returns the node more strictly typed iff it is of the given type. Otherwise,
 * returns null.
 */function checkNodeType(node,type){if(node&&node.type===type){// The definition of ParseNode<TYPE> doesn't communicate to flow that
// `type: TYPE` (as that's not explicitly mentioned anywhere), though that
// happens to be true for all our value types.
// $FlowFixMe
return node;}return null;}/**
 * Asserts that the node is of the given type and returns it with stricter
 * typing. Throws if the node's type does not match.
 */function assertAtomFamily(node,family){const typedNode=checkAtomFamily(node,family);if(!typedNode){throw new Error(`Expected node of type "atom" and family "${family}", but got `+(node?node.type==="atom"?`atom of family ${node.family}`:`node of type ${node.type}`:String(node)));}return typedNode;}/**
 * Returns the node more strictly typed iff it is of the given type. Otherwise,
 * returns null.
 */function checkAtomFamily(node,family){return node&&node.type==="atom"&&node.family===family?node:null;}/**
 * Returns the node more strictly typed iff it is of the given type. Otherwise,
 * returns null.
 */function assertSymbolNodeType(node){const typedNode=checkSymbolNodeType(node);if(!typedNode){throw new Error(`Expected node of symbol group type, but got `+(node?`node of type ${node.type}`:String(node)));}return typedNode;}/**
 * Returns the node more strictly typed iff it is of the given type. Otherwise,
 * returns null.
 */function checkSymbolNodeType(node){if(node&&(node.type==="atom"||NON_ATOMS.hasOwnProperty(node.type))){// $FlowFixMe
return node;}return null;}/**
 * Describes spaces between different classes of atoms.
 */const thinspace={number:3,unit:"mu"};const mediumspace={number:4,unit:"mu"};const thickspace={number:5,unit:"mu"};// Making the type below exact with all optional fields doesn't work due to
// - https://github.com/facebook/flow/issues/4582
// - https://github.com/facebook/flow/issues/5688
// However, since *all* fields are optional, $Shape<> works as suggested in 5688
// above.
// Spacing relationships for display and text styles
const spacings={mord:{mop:thinspace,mbin:mediumspace,mrel:thickspace,minner:thinspace},mop:{mord:thinspace,mop:thinspace,mrel:thickspace,minner:thinspace},mbin:{mord:mediumspace,mop:mediumspace,mopen:mediumspace,minner:mediumspace},mrel:{mord:thickspace,mop:thickspace,mopen:thickspace,minner:thickspace},mopen:{},mclose:{mop:thinspace,mbin:mediumspace,mrel:thickspace,minner:thinspace},mpunct:{mord:thinspace,mop:thinspace,mrel:thickspace,mopen:thinspace,mclose:thinspace,mpunct:thinspace,minner:thinspace},minner:{mord:thinspace,mop:thinspace,mbin:mediumspace,mrel:thickspace,mopen:thinspace,mpunct:thinspace,minner:thinspace}};// Spacing relationships for script and scriptscript styles
const tightSpacings={mord:{mop:thinspace},mop:{mord:thinspace,mop:thinspace},mbin:{},mrel:{},mopen:{},mclose:{mop:thinspace},mpunct:{},minner:{mop:thinspace}};/**
 * All registered functions.
 * `functions.js` just exports this same dictionary again and makes it public.
 * `Parser.js` requires this dictionary.
 */const _functions={};/**
 * All HTML builders. Should be only used in the `define*` and the `build*ML`
 * functions.
 */const _htmlGroupBuilders={};/**
 * All MathML builders. Should be only used in the `define*` and the `build*ML`
 * functions.
 */const _mathmlGroupBuilders={};function defineFunction(_ref){let type=_ref.type,nodeType=_ref.nodeType,names=_ref.names,props=_ref.props,handler=_ref.handler,htmlBuilder=_ref.htmlBuilder,mathmlBuilder=_ref.mathmlBuilder;// Set default values of functions
const data={type,numArgs:props.numArgs,argTypes:props.argTypes,greediness:props.greediness===undefined?1:props.greediness,allowedInText:!!props.allowedInText,allowedInMath:props.allowedInMath===undefined?true:props.allowedInMath,numOptionalArgs:props.numOptionalArgs||0,infix:!!props.infix,consumeMode:props.consumeMode,handler:handler};for(let i=0;i<names.length;++i){// TODO: The value type of _functions should be a type union of all
// possible `FunctionSpec<>` possibilities instead of `FunctionSpec<*>`,
// which is an existential type.
// $FlowFixMe
_functions[names[i]]=data;}if(type){if(htmlBuilder){_htmlGroupBuilders[type]=htmlBuilder;}if(mathmlBuilder){_mathmlGroupBuilders[type]=mathmlBuilder;}}}/**
 * Use this to register only the HTML and MathML builders for a function (e.g.
 * if the function's ParseNode is generated in Parser.js rather than via a
 * stand-alone handler provided to `defineFunction`).
 */function defineFunctionBuilders(_ref2){let type=_ref2.type,htmlBuilder=_ref2.htmlBuilder,mathmlBuilder=_ref2.mathmlBuilder;defineFunction({type,names:[],props:{numArgs:0},handler(){throw new Error('Should never be called.');},htmlBuilder,mathmlBuilder});}// Since the corresponding buildHTML/buildMathML function expects a
// list of elements, we normalize for different kinds of arguments
const ordargument=function ordargument(arg){const node=checkNodeType(arg,"ordgroup");return node?node.body:[arg];};/**
 * This file does the main work of building a domTree structure from a parse
 * tree. The entry point is the `buildHTML` function, which takes a parse tree.
 * Then, the buildExpression, buildGroup, and various groupBuilders functions
 * are called, to produce a final HTML tree.
 */const makeSpan$1=buildCommon.makeSpan;// Binary atoms (first class `mbin`) change into ordinary atoms (`mord`)
// depending on their surroundings. See TeXbook pg. 442-446, Rules 5 and 6,
// and the text before Rule 19.
const binLeftCanceller=["leftmost","mbin","mopen","mrel","mop","mpunct"];const binRightCanceller=["rightmost","mrel","mclose","mpunct"];const styleMap={"display":Style$1.DISPLAY,"text":Style$1.TEXT,"script":Style$1.SCRIPT,"scriptscript":Style$1.SCRIPTSCRIPT};const DomEnum={mord:"mord",mop:"mop",mbin:"mbin",mrel:"mrel",mopen:"mopen",mclose:"mclose",mpunct:"mpunct",minner:"minner"};/**
 * Take a list of nodes, build them in order, and return a list of the built
 * nodes. documentFragments are flattened into their contents, so the
 * returned list contains no fragments. `isRealGroup` is true if `expression`
 * is a real group (no atoms will be added on either side), as opposed to
 * a partial group (e.g. one created by \color). `surrounding` is an array
 * consisting type of nodes that will be added to the left and right.
 */const buildExpression=function buildExpression(expression,options,isRealGroup,surrounding){if(surrounding===void 0){surrounding=[null,null];}// Parse expressions into `groups`.
const groups=[];for(let i=0;i<expression.length;i++){const output=buildGroup(expression[i],options);if(output instanceof DocumentFragment){const children=output.children;groups.push(...children);}else{groups.push(output);}}// If `expression` is a partial group, let the parent handle spacings
// to avoid processing groups multiple times.
if(!isRealGroup){return groups;}let glueOptions=options;if(expression.length===1){const node=checkNodeType(expression[0],"sizing")||checkNodeType(expression[0],"styling");if(!node);else if(node.type==="sizing"){glueOptions=options.havingSize(node.size);}else if(node.type==="styling"){glueOptions=options.havingStyle(styleMap[node.style]);}}// Dummy spans for determining spacings between surrounding atoms.
// If `expression` has no atoms on the left or right, class "leftmost"
// or "rightmost", respectively, is used to indicate it.
const dummyPrev=makeSpan$1([surrounding[0]||"leftmost"],[],options);const dummyNext=makeSpan$1([surrounding[1]||"rightmost"],[],options);// TODO: These code assumes that a node's math class is the first element
// of its `classes` array. A later cleanup should ensure this, for
// instance by changing the signature of `makeSpan`.
// Before determining what spaces to insert, perform bin cancellation.
// Binary operators change to ordinary symbols in some contexts.
traverseNonSpaceNodes(groups,(node,prev)=>{const prevType=prev.classes[0];const type=node.classes[0];if(prevType==="mbin"&&utils.contains(binRightCanceller,type)){prev.classes[0]="mord";}else if(type==="mbin"&&utils.contains(binLeftCanceller,prevType)){node.classes[0]="mord";}},{node:dummyPrev},dummyNext);traverseNonSpaceNodes(groups,(node,prev)=>{const prevType=getTypeOfDomTree(prev);const type=getTypeOfDomTree(node);// 'mtight' indicates that the node is script or scriptscript style.
const space=prevType&&type?node.hasClass("mtight")?tightSpacings[prevType][type]:spacings[prevType][type]:null;if(space){// Insert glue (spacing) after the `prev`.
return buildCommon.makeGlue(space,glueOptions);}},{node:dummyPrev},dummyNext);return groups;};// Depth-first traverse non-space `nodes`, calling `callback` with the current and
// previous node as arguments, optionally returning a node to insert after the
// previous node. `prev` is an object with the previous node and `insertAfter`
// function to insert after it. `next` is a node that will be added to the right.
// Used for bin cancellation and inserting spacings.
const traverseNonSpaceNodes=function traverseNonSpaceNodes(nodes,callback,prev,next){if(next){// temporarily append the right node, if exists
nodes.push(next);}let i=0;for(;i<nodes.length;i++){const node=nodes[i];const partialGroup=checkPartialGroup(node);if(partialGroup){// Recursive DFS
traverseNonSpaceNodes(partialGroup.children,callback,prev);continue;}// Ignore explicit spaces (e.g., \;, \,) when determining what implicit
// spacing should go between atoms of different classes
if(node.classes[0]==="mspace"){continue;}const result=callback(node,prev.node);if(result){if(prev.insertAfter){prev.insertAfter(result);}else{// insert at front
nodes.unshift(result);i++;}}prev.node=node;prev.insertAfter=(index=>n=>{nodes.splice(index+1,0,n);i++;})(i);}if(next){nodes.pop();}};// Check if given node is a partial group, i.e., does not affect spacing around.
const checkPartialGroup=function checkPartialGroup(node){if(node instanceof DocumentFragment||node instanceof Anchor){return node;}return null;};// Return the outermost node of a domTree.
const getOutermostNode=function getOutermostNode(node,side){const partialGroup=checkPartialGroup(node);if(partialGroup){const children=partialGroup.children;if(children.length){if(side==="right"){return getOutermostNode(children[children.length-1],"right");}else if(side==="left"){return getOutermostNode(children[0],"left");}}}return node;};// Return math atom class (mclass) of a domTree.
// If `side` is given, it will get the type of the outermost node at given side.
const getTypeOfDomTree=function getTypeOfDomTree(node,side){if(!node){return null;}if(side){node=getOutermostNode(node,side);}// This makes a lot of assumptions as to where the type of atom
// appears.  We should do a better job of enforcing this.
return DomEnum[node.classes[0]]||null;};const makeNullDelimiter=function makeNullDelimiter(options,classes){const moreClasses=["nulldelimiter"].concat(options.baseSizingClasses());return makeSpan$1(classes.concat(moreClasses));};/**
 * buildGroup is the function that takes a group and calls the correct groupType
 * function for it. It also handles the interaction of size and style changes
 * between parents and children.
 */const buildGroup=function buildGroup(group,options,baseOptions){if(!group){return makeSpan$1();}if(_htmlGroupBuilders[group.type]){// Call the groupBuilders function
let groupNode=_htmlGroupBuilders[group.type](group,options);// If the size changed between the parent and the current group, account
// for that size difference.
if(baseOptions&&options.size!==baseOptions.size){groupNode=makeSpan$1(options.sizingClasses(baseOptions),[groupNode],options);const multiplier=options.sizeMultiplier/baseOptions.sizeMultiplier;groupNode.height*=multiplier;groupNode.depth*=multiplier;}return groupNode;}else{throw new ParseError("Got group of unknown type: '"+group.type+"'");}};/**
 * Combine an array of HTML DOM nodes (e.g., the output of `buildExpression`)
 * into an unbreakable HTML node of class .base, with proper struts to
 * guarantee correct vertical extent.  `buildHTML` calls this repeatedly to
 * make up the entire expression as a sequence of unbreakable units.
 */function buildHTMLUnbreakable(children,options){// Compute height and depth of this chunk.
const body=makeSpan$1(["base"],children,options);// Add strut, which ensures that the top of the HTML element falls at
// the height of the expression, and the bottom of the HTML element
// falls at the depth of the expression.
// We used to have separate top and bottom struts, where the bottom strut
// would like to use `vertical-align: top`, but in IE 9 this lowers the
// baseline of the box to the bottom of this strut (instead of staying in
// the normal place) so we use an absolute value for vertical-align instead.
const strut=makeSpan$1(["strut"]);strut.style.height=body.height+body.depth+"em";strut.style.verticalAlign=-body.depth+"em";body.children.unshift(strut);return body;}/**
 * Take an entire parse tree, and build it into an appropriate set of HTML
 * nodes.
 */function buildHTML(tree,options){// Strip off outer tag wrapper for processing below.
let tag=null;if(tree.length===1&&tree[0].type==="tag"){tag=tree[0].tag;tree=tree[0].body;}// Build the expression contained in the tree
const expression=buildExpression(tree,options,true);const children=[];// Create one base node for each chunk between potential line breaks.
// The TeXBook [p.173] says "A formula will be broken only after a
// relation symbol like $=$ or $<$ or $\rightarrow$, or after a binary
// operation symbol like $+$ or $-$ or $\times$, where the relation or
// binary operation is on the ``outer level'' of the formula (i.e., not
// enclosed in {...} and not part of an \over construction)."
let parts=[];for(let i=0;i<expression.length;i++){parts.push(expression[i]);if(expression[i].hasClass("mbin")||expression[i].hasClass("mrel")||expression[i].hasClass("allowbreak")){// Put any post-operator glue on same line as operator.
// Watch for \nobreak along the way, and stop at \newline.
let nobreak=false;while(i<expression.length-1&&expression[i+1].hasClass("mspace")&&!expression[i+1].hasClass("newline")){i++;parts.push(expression[i]);if(expression[i].hasClass("nobreak")){nobreak=true;}}// Don't allow break if \nobreak among the post-operator glue.
if(!nobreak){children.push(buildHTMLUnbreakable(parts,options));parts=[];}}else if(expression[i].hasClass("newline")){// Write the line except the newline
parts.pop();if(parts.length>0){children.push(buildHTMLUnbreakable(parts,options));parts=[];}// Put the newline at the top level
children.push(expression[i]);}}if(parts.length>0){children.push(buildHTMLUnbreakable(parts,options));}// Now, if there was a tag, build it too and append it as a final child.
let tagChild;if(tag){tagChild=buildHTMLUnbreakable(buildExpression(tag,options,true));tagChild.classes=["tag"];children.push(tagChild);}const htmlNode=makeSpan$1(["katex-html"],children);htmlNode.setAttribute("aria-hidden","true");// Adjust the strut of the tag to be the maximum height of all children
// (the height of the enclosing htmlNode) for proper vertical alignment.
if(tagChild){const strut=tagChild.children[0];strut.style.height=htmlNode.height+htmlNode.depth+"em";strut.style.verticalAlign=-htmlNode.depth+"em";}return htmlNode;}/**
 * These objects store data about MathML nodes. This is the MathML equivalent
 * of the types in domTree.js. Since MathML handles its own rendering, and
 * since we're mainly using MathML to improve accessibility, we don't manage
 * any of the styling state that the plain DOM nodes do.
 *
 * The `toNode` and `toMarkup` functions work simlarly to how they do in
 * domTree.js, creating namespaced DOM nodes and HTML text markup respectively.
 */function newDocumentFragment(children){return new DocumentFragment(children);}/**
 * This node represents a general purpose MathML node of any type. The
 * constructor requires the type of node to create (for example, `"mo"` or
 * `"mspace"`, corresponding to `<mo>` and `<mspace>` tags).
 */class MathNode{constructor(type,children){this.type=void 0;this.attributes=void 0;this.children=void 0;this.type=type;this.attributes={};this.children=children||[];}/**
   * Sets an attribute on a MathML node. MathML depends on attributes to convey a
   * semantic content, so this is used heavily.
   */setAttribute(name,value){this.attributes[name]=value;}/**
   * Gets an attribute on a MathML node.
   */getAttribute(name){return this.attributes[name];}/**
   * Converts the math node into a MathML-namespaced DOM element.
   */toNode(){const node=document.createElementNS("http://www.w3.org/1998/Math/MathML",this.type);for(const attr in this.attributes){if(Object.prototype.hasOwnProperty.call(this.attributes,attr)){node.setAttribute(attr,this.attributes[attr]);}}for(let i=0;i<this.children.length;i++){node.appendChild(this.children[i].toNode());}return node;}/**
   * Converts the math node into an HTML markup string.
   */toMarkup(){let markup="<"+this.type;// Add the attributes
for(const attr in this.attributes){if(Object.prototype.hasOwnProperty.call(this.attributes,attr)){markup+=" "+attr+"=\"";markup+=utils.escape(this.attributes[attr]);markup+="\"";}}markup+=">";for(let i=0;i<this.children.length;i++){markup+=this.children[i].toMarkup();}markup+="</"+this.type+">";return markup;}/**
   * Converts the math node into a string, similar to innerText, but escaped.
   */toText(){return this.children.map(child=>child.toText()).join("");}}/**
 * This node represents a piece of text.
 */class TextNode{constructor(text){this.text=void 0;this.text=text;}/**
   * Converts the text node into a DOM text node.
   */toNode(){return document.createTextNode(this.text);}/**
   * Converts the text node into escaped HTML markup
   * (representing the text itself).
   */toMarkup(){return utils.escape(this.toText());}/**
   * Converts the text node into a string
   * (representing the text iteself).
   */toText(){return this.text;}}/**
 * This node represents a space, but may render as <mspace.../> or as text,
 * depending on the width.
 */class SpaceNode{/**
   * Create a Space node with width given in CSS ems.
   */constructor(width){this.width=void 0;this.character=void 0;this.width=width;// See https://www.w3.org/TR/2000/WD-MathML2-20000328/chapter6.html
// for a table of space-like characters.  We use Unicode
// representations instead of &LongNames; as it's not clear how to
// make the latter via document.createTextNode.
if(width>=0.05555&&width<=0.05556){this.character="\u200a";// &VeryThinSpace;
}else if(width>=0.1666&&width<=0.1667){this.character="\u2009";// &ThinSpace;
}else if(width>=0.2222&&width<=0.2223){this.character="\u2005";// &MediumSpace;
}else if(width>=0.2777&&width<=0.2778){this.character="\u2005\u200a";// &ThickSpace;
}else if(width>=-0.05556&&width<=-0.05555){this.character="\u200a\u2063";// &NegativeVeryThinSpace;
}else if(width>=-0.1667&&width<=-0.1666){this.character="\u2009\u2063";// &NegativeThinSpace;
}else if(width>=-0.2223&&width<=-0.2222){this.character="\u205f\u2063";// &NegativeMediumSpace;
}else if(width>=-0.2778&&width<=-0.2777){this.character="\u2005\u2063";// &NegativeThickSpace;
}else{this.character=null;}}/**
   * Converts the math node into a MathML-namespaced DOM element.
   */toNode(){if(this.character){return document.createTextNode(this.character);}else{const node=document.createElementNS("http://www.w3.org/1998/Math/MathML","mspace");node.setAttribute("width",this.width+"em");return node;}}/**
   * Converts the math node into an HTML markup string.
   */toMarkup(){if(this.character){return `<mtext>${this.character}</mtext>`;}else{return `<mspace width="${this.width}em"/>`;}}/**
   * Converts the math node into a string, similar to innerText.
   */toText(){if(this.character){return this.character;}else{return " ";}}}var mathMLTree={MathNode,TextNode,SpaceNode,newDocumentFragment};/**
 * This file converts a parse tree into a cooresponding MathML tree. The main
 * entry point is the `buildMathML` function, which takes a parse tree from the
 * parser.
 */ /**
 * Takes a symbol and converts it into a MathML text node after performing
 * optional replacement from symbols.js.
 */const makeText=function makeText(text,mode,options){if(symbols[mode][text]&&symbols[mode][text].replace&&text.charCodeAt(0)!==0xD835&&!(ligatures.hasOwnProperty(text)&&options&&(options.fontFamily&&options.fontFamily.substr(4,2)==="tt"||options.font&&options.font.substr(4,2)==="tt"))){text=symbols[mode][text].replace;}return new mathMLTree.TextNode(text);};/**
 * Wrap the given array of nodes in an <mrow> node if needed, i.e.,
 * unless the array has length 1.  Always returns a single node.
 */const makeRow=function makeRow(body){if(body.length===1){return body[0];}else{return new mathMLTree.MathNode("mrow",body);}};/**
 * Returns the math variant as a string or null if none is required.
 */const getVariant=function getVariant(group,options){// Handle \text... font specifiers as best we can.
// MathML has a limited list of allowable mathvariant specifiers; see
// https://www.w3.org/TR/MathML3/chapter3.html#presm.commatt
if(options.fontFamily==="texttt"){return "monospace";}else if(options.fontFamily==="textsf"){if(options.fontShape==="textit"&&options.fontWeight==="textbf"){return "sans-serif-bold-italic";}else if(options.fontShape==="textit"){return "sans-serif-italic";}else if(options.fontWeight==="textbf"){return "bold-sans-serif";}else{return "sans-serif";}}else if(options.fontShape==="textit"&&options.fontWeight==="textbf"){return "bold-italic";}else if(options.fontShape==="textit"){return "italic";}else if(options.fontWeight==="textbf"){return "bold";}const font=options.font;if(!font||font==="mathnormal"){return null;}const mode=group.mode;if(font==="mathit"){return "italic";}else if(font==="boldsymbol"){return "bold-italic";}let text=group.text;if(utils.contains(["\\imath","\\jmath"],text)){return null;}if(symbols[mode][text]&&symbols[mode][text].replace){text=symbols[mode][text].replace;}const fontName=buildCommon.fontMap[font].fontName;if(getCharacterMetrics(text,fontName,mode)){return buildCommon.fontMap[font].variant;}return null;};/**
 * Takes a list of nodes, builds them, and returns a list of the generated
 * MathML nodes.  Also combine consecutive <mtext> outputs into a single
 * <mtext> tag.
 */const buildExpression$1=function buildExpression(expression,options){const groups=[];let lastGroup;for(let i=0;i<expression.length;i++){const group=buildGroup$1(expression[i],options);if(group instanceof MathNode&&lastGroup instanceof MathNode){// Concatenate adjacent <mtext>s
if(group.type==='mtext'&&lastGroup.type==='mtext'&&group.getAttribute('mathvariant')===lastGroup.getAttribute('mathvariant')){lastGroup.children.push(...group.children);continue;// Concatenate adjacent <mn>s
}else if(group.type==='mn'&&lastGroup.type==='mn'){lastGroup.children.push(...group.children);continue;// Concatenate <mn>...</mn> followed by <mi>.</mi>
}else if(group.type==='mi'&&group.children.length===1&&lastGroup.type==='mn'){const child=group.children[0];if(child instanceof TextNode&&child.text==='.'){lastGroup.children.push(...group.children);continue;}}}groups.push(group);lastGroup=group;}// TODO(kevinb): combine \\not with mrels and mords
return groups;};/**
 * Equivalent to buildExpression, but wraps the elements in an <mrow>
 * if there's more than one.  Returns a single node instead of an array.
 */const buildExpressionRow=function buildExpressionRow(expression,options){return makeRow(buildExpression$1(expression,options));};/**
 * Takes a group from the parser and calls the appropriate groupBuilders function
 * on it to produce a MathML node.
 */const buildGroup$1=function buildGroup(group,options){if(!group){return new mathMLTree.MathNode("mrow");}if(_mathmlGroupBuilders[group.type]){// Call the groupBuilders function
const result=_mathmlGroupBuilders[group.type](group,options);return result;}else{throw new ParseError("Got group of unknown type: '"+group.type+"'");}};/**
 * Takes a full parse tree and settings and builds a MathML representation of
 * it. In particular, we put the elements from building the parse tree into a
 * <semantics> tag so we can also include that TeX source as an annotation.
 *
 * Note that we actually return a domTree element with a `<math>` inside it so
 * we can do appropriate styling.
 */function buildMathML(tree,texExpression,options){const expression=buildExpression$1(tree,options);// Wrap up the expression in an mrow so it is presented in the semantics
// tag correctly, unless it's a single <mrow> or <mtable>.
let wrapper;if(expression.length===1&&expression[0]instanceof MathNode&&utils.contains(["mrow","mtable"],expression[0].type)){wrapper=expression[0];}else{wrapper=new mathMLTree.MathNode("mrow",expression);}// Build a TeX annotation of the source
const annotation=new mathMLTree.MathNode("annotation",[new mathMLTree.TextNode(texExpression)]);annotation.setAttribute("encoding","application/x-tex");const semantics=new mathMLTree.MathNode("semantics",[wrapper,annotation]);const math=new mathMLTree.MathNode("math",[semantics]);// You can't style <math> nodes, so we wrap the node in a span.
// NOTE: The span class is not typed to have <math> nodes as children, and
// we don't want to make the children type more generic since the children
// of span are expected to have more fields in `buildHtml` contexts.
// $FlowFixMe
return buildCommon.makeSpan(["katex-mathml"],[math]);}const optionsFromSettings=function optionsFromSettings(settings){return new Options({style:settings.displayMode?Style$1.DISPLAY:Style$1.TEXT,maxSize:settings.maxSize});};const displayWrap=function displayWrap(node,settings){if(settings.displayMode){const classes=["katex-display"];if(settings.leqno){classes.push("leqno");}if(settings.fleqn){classes.push("fleqn");}node=buildCommon.makeSpan(classes,[node]);}return node;};const buildTree=function buildTree(tree,expression,settings){const options=optionsFromSettings(settings);const mathMLNode=buildMathML(tree,expression,options);const htmlNode=buildHTML(tree,options);const katexNode=buildCommon.makeSpan(["katex"],[mathMLNode,htmlNode]);return displayWrap(katexNode,settings);};const buildHTMLTree=function buildHTMLTree(tree,expression,settings){const options=optionsFromSettings(settings);const htmlNode=buildHTML(tree,options);const katexNode=buildCommon.makeSpan(["katex"],[htmlNode]);return displayWrap(katexNode,settings);};/**
 * This file provides support to buildMathML.js and buildHTML.js
 * for stretchy wide elements rendered from SVG files
 * and other CSS trickery.
 */const stretchyCodePoint={widehat:"^",widecheck:"ˇ",widetilde:"~",utilde:"~",overleftarrow:"\u2190",underleftarrow:"\u2190",xleftarrow:"\u2190",overrightarrow:"\u2192",underrightarrow:"\u2192",xrightarrow:"\u2192",underbrace:"\u23b5",overbrace:"\u23de",overleftrightarrow:"\u2194",underleftrightarrow:"\u2194",xleftrightarrow:"\u2194",Overrightarrow:"\u21d2",xRightarrow:"\u21d2",overleftharpoon:"\u21bc",xleftharpoonup:"\u21bc",overrightharpoon:"\u21c0",xrightharpoonup:"\u21c0",xLeftarrow:"\u21d0",xLeftrightarrow:"\u21d4",xhookleftarrow:"\u21a9",xhookrightarrow:"\u21aa",xmapsto:"\u21a6",xrightharpoondown:"\u21c1",xleftharpoondown:"\u21bd",xrightleftharpoons:"\u21cc",xleftrightharpoons:"\u21cb",xtwoheadleftarrow:"\u219e",xtwoheadrightarrow:"\u21a0",xlongequal:"=",xtofrom:"\u21c4",xrightleftarrows:"\u21c4",xrightequilibrium:"\u21cc",// Not a perfect match.
xleftequilibrium:"\u21cb"// None better available.
};const mathMLnode=function mathMLnode(label){const node=new mathMLTree.MathNode("mo",[new mathMLTree.TextNode(stretchyCodePoint[label.substr(1)])]);node.setAttribute("stretchy","true");return node;};// Many of the KaTeX SVG images have been adapted from glyphs in KaTeX fonts.
// Copyright (c) 2009-2010, Design Science, Inc. (<www.mathjax.org>)
// Copyright (c) 2014-2017 Khan Academy (<www.khanacademy.org>)
// Licensed under the SIL Open Font License, Version 1.1.
// See \nhttp://scripts.sil.org/OFL
// Very Long SVGs
//    Many of the KaTeX stretchy wide elements use a long SVG image and an
//    overflow: hidden tactic to achieve a stretchy image while avoiding
//    distortion of arrowheads or brace corners.
//    The SVG typically contains a very long (400 em) arrow.
//    The SVG is in a container span that has overflow: hidden, so the span
//    acts like a window that exposes only part of the  SVG.
//    The SVG always has a longer, thinner aspect ratio than the container span.
//    After the SVG fills 100% of the height of the container span,
//    there is a long arrow shaft left over. That left-over shaft is not shown.
//    Instead, it is sliced off because the span's CSS has overflow: hidden.
//    Thus, the reader sees an arrow that matches the subject matter width
//    without distortion.
//    Some functions, such as \cancel, need to vary their aspect ratio. These
//    functions do not get the overflow SVG treatment.
// Second Brush Stroke
//    Low resolution monitors struggle to display images in fine detail.
//    So browsers apply anti-aliasing. A long straight arrow shaft therefore
//    will sometimes appear as if it has a blurred edge.
//    To mitigate this, these SVG files contain a second "brush-stroke" on the
//    arrow shafts. That is, a second long thin rectangular SVG path has been
//    written directly on top of each arrow shaft. This reinforcement causes
//    some of the screen pixels to display as black instead of the anti-aliased
//    gray pixel that a  single path would generate. So we get arrow shafts
//    whose edges appear to be sharper.
// In the katexImagesData object just below, the dimensions all
// correspond to path geometry inside the relevant SVG.
// For example, \overrightarrow uses the same arrowhead as glyph U+2192
// from the KaTeX Main font. The scaling factor is 1000.
// That is, inside the font, that arrowhead is 522 units tall, which
// corresponds to 0.522 em inside the document.
const katexImagesData={//   path(s), minWidth, height, align
overrightarrow:[["rightarrow"],0.888,522,"xMaxYMin"],overleftarrow:[["leftarrow"],0.888,522,"xMinYMin"],underrightarrow:[["rightarrow"],0.888,522,"xMaxYMin"],underleftarrow:[["leftarrow"],0.888,522,"xMinYMin"],xrightarrow:[["rightarrow"],1.469,522,"xMaxYMin"],xleftarrow:[["leftarrow"],1.469,522,"xMinYMin"],Overrightarrow:[["doublerightarrow"],0.888,560,"xMaxYMin"],xRightarrow:[["doublerightarrow"],1.526,560,"xMaxYMin"],xLeftarrow:[["doubleleftarrow"],1.526,560,"xMinYMin"],overleftharpoon:[["leftharpoon"],0.888,522,"xMinYMin"],xleftharpoonup:[["leftharpoon"],0.888,522,"xMinYMin"],xleftharpoondown:[["leftharpoondown"],0.888,522,"xMinYMin"],overrightharpoon:[["rightharpoon"],0.888,522,"xMaxYMin"],xrightharpoonup:[["rightharpoon"],0.888,522,"xMaxYMin"],xrightharpoondown:[["rightharpoondown"],0.888,522,"xMaxYMin"],xlongequal:[["longequal"],0.888,334,"xMinYMin"],xtwoheadleftarrow:[["twoheadleftarrow"],0.888,334,"xMinYMin"],xtwoheadrightarrow:[["twoheadrightarrow"],0.888,334,"xMaxYMin"],overleftrightarrow:[["leftarrow","rightarrow"],0.888,522],overbrace:[["leftbrace","midbrace","rightbrace"],1.6,548],underbrace:[["leftbraceunder","midbraceunder","rightbraceunder"],1.6,548],underleftrightarrow:[["leftarrow","rightarrow"],0.888,522],xleftrightarrow:[["leftarrow","rightarrow"],1.75,522],xLeftrightarrow:[["doubleleftarrow","doublerightarrow"],1.75,560],xrightleftharpoons:[["leftharpoondownplus","rightharpoonplus"],1.75,716],xleftrightharpoons:[["leftharpoonplus","rightharpoondownplus"],1.75,716],xhookleftarrow:[["leftarrow","righthook"],1.08,522],xhookrightarrow:[["lefthook","rightarrow"],1.08,522],overlinesegment:[["leftlinesegment","rightlinesegment"],0.888,522],underlinesegment:[["leftlinesegment","rightlinesegment"],0.888,522],overgroup:[["leftgroup","rightgroup"],0.888,342],undergroup:[["leftgroupunder","rightgroupunder"],0.888,342],xmapsto:[["leftmapsto","rightarrow"],1.5,522],xtofrom:[["leftToFrom","rightToFrom"],1.75,528],// The next three arrows are from the mhchem package.
// In mhchem.sty, min-length is 2.0em. But these arrows might appear in the
// document as \xrightarrow or \xrightleftharpoons. Those have
// min-length = 1.75em, so we set min-length on these next three to match.
xrightleftarrows:[["baraboveleftarrow","rightarrowabovebar"],1.75,901],xrightequilibrium:[["baraboveshortleftharpoon","rightharpoonaboveshortbar"],1.75,716],xleftequilibrium:[["shortbaraboveleftharpoon","shortrightharpoonabovebar"],1.75,716]};const groupLength=function groupLength(arg){if(arg.type==="ordgroup"){return arg.body.length;}else{return 1;}};const svgSpan=function svgSpan(group,options){// Create a span with inline SVG for the element.
function buildSvgSpan_(){let viewBoxWidth=400000;// default
const label=group.label.substr(1);if(utils.contains(["widehat","widecheck","widetilde","utilde"],label)){// Each type in the `if` statement corresponds to one of the ParseNode
// types below. This narrowing is required to access `grp.base`.
const grp=group;// There are four SVG images available for each function.
// Choose a taller image when there are more characters.
const numChars=groupLength(grp.base);let viewBoxHeight;let pathName;let height;if(numChars>5){if(label==="widehat"||label==="widecheck"){viewBoxHeight=420;viewBoxWidth=2364;height=0.42;pathName=label+"4";}else{viewBoxHeight=312;viewBoxWidth=2340;height=0.34;pathName="tilde4";}}else{const imgIndex=[1,1,2,2,3,3][numChars];if(label==="widehat"||label==="widecheck"){viewBoxWidth=[0,1062,2364,2364,2364][imgIndex];viewBoxHeight=[0,239,300,360,420][imgIndex];height=[0,0.24,0.3,0.3,0.36,0.42][imgIndex];pathName=label+imgIndex;}else{viewBoxWidth=[0,600,1033,2339,2340][imgIndex];viewBoxHeight=[0,260,286,306,312][imgIndex];height=[0,0.26,0.286,0.3,0.306,0.34][imgIndex];pathName="tilde"+imgIndex;}}const path=new PathNode(pathName);const svgNode=new SvgNode([path],{"width":"100%","height":height+"em","viewBox":`0 0 ${viewBoxWidth} ${viewBoxHeight}`,"preserveAspectRatio":"none"});return {span:buildCommon.makeSvgSpan([],[svgNode],options),minWidth:0,height};}else{const spans=[];const data=katexImagesData[label];const paths=data[0],minWidth=data[1],viewBoxHeight=data[2];const height=viewBoxHeight/1000;const numSvgChildren=paths.length;let widthClasses;let aligns;if(numSvgChildren===1){// $FlowFixMe: All these cases must be of the 4-tuple type.
const align1=data[3];widthClasses=["hide-tail"];aligns=[align1];}else if(numSvgChildren===2){widthClasses=["halfarrow-left","halfarrow-right"];aligns=["xMinYMin","xMaxYMin"];}else if(numSvgChildren===3){widthClasses=["brace-left","brace-center","brace-right"];aligns=["xMinYMin","xMidYMin","xMaxYMin"];}else{throw new Error(`Correct katexImagesData or update code here to support
                    ${numSvgChildren} children.`);}for(let i=0;i<numSvgChildren;i++){const path=new PathNode(paths[i]);const svgNode=new SvgNode([path],{"width":"400em","height":height+"em","viewBox":`0 0 ${viewBoxWidth} ${viewBoxHeight}`,"preserveAspectRatio":aligns[i]+" slice"});const span=buildCommon.makeSvgSpan([widthClasses[i]],[svgNode],options);if(numSvgChildren===1){return {span,minWidth,height};}else{span.style.height=height+"em";spans.push(span);}}return {span:buildCommon.makeSpan(["stretchy"],spans,options),minWidth,height};}}// buildSvgSpan_()
const _buildSvgSpan_=buildSvgSpan_(),span=_buildSvgSpan_.span,minWidth=_buildSvgSpan_.minWidth,height=_buildSvgSpan_.height;// Note that we are returning span.depth = 0.
// Any adjustments relative to the baseline must be done in buildHTML.
span.height=height;span.style.height=height+"em";if(minWidth>0){span.style.minWidth=minWidth+"em";}return span;};const encloseSpan=function encloseSpan(inner,label,pad,options){// Return an image span for \cancel, \bcancel, \xcancel, or \fbox
let img;const totalHeight=inner.height+inner.depth+2*pad;if(/fbox|color/.test(label)){img=buildCommon.makeSpan(["stretchy",label],[],options);if(label==="fbox"){const color=options.color&&options.getColor();if(color){img.style.borderColor=color;}}}else{// \cancel, \bcancel, or \xcancel
// Since \cancel's SVG is inline and it omits the viewBox attribute,
// its stroke-width will not vary with span area.
const lines=[];if(/^[bx]cancel$/.test(label)){lines.push(new LineNode({"x1":"0","y1":"0","x2":"100%","y2":"100%","stroke-width":"0.046em"}));}if(/^x?cancel$/.test(label)){lines.push(new LineNode({"x1":"0","y1":"100%","x2":"100%","y2":"0","stroke-width":"0.046em"}));}const svgNode=new SvgNode(lines,{"width":"100%","height":totalHeight+"em"});img=buildCommon.makeSvgSpan([],[svgNode],options);}img.height=totalHeight;img.style.height=totalHeight+"em";return img;};var stretchy={encloseSpan,mathMLnode,svgSpan};// NOTE: Unlike most `htmlBuilder`s, this one handles not only "accent", but
const htmlBuilder=(grp,options)=>{// Accents are handled in the TeXbook pg. 443, rule 12.
let base;let group;const supSub=checkNodeType(grp,"supsub");let supSubGroup;if(supSub){// If our base is a character box, and we have superscripts and
// subscripts, the supsub will defer to us. In particular, we want
// to attach the superscripts and subscripts to the inner body (so
// that the position of the superscripts and subscripts won't be
// affected by the height of the accent). We accomplish this by
// sticking the base of the accent into the base of the supsub, and
// rendering that, while keeping track of where the accent is.
// The real accent group is the base of the supsub group
group=assertNodeType(supSub.base,"accent");// The character box is the base of the accent group
base=group.base;// Stick the character box into the base of the supsub group
supSub.base=base;// Rerender the supsub group with its new base, and store that
// result.
supSubGroup=assertSpan(buildGroup(supSub,options));// reset original base
supSub.base=group;}else{group=assertNodeType(grp,"accent");base=group.base;}// Build the base group
const body=buildGroup(base,options.havingCrampedStyle());// Does the accent need to shift for the skew of a character?
const mustShift=group.isShifty&&utils.isCharacterBox(base);// Calculate the skew of the accent. This is based on the line "If the
// nucleus is not a single character, let s = 0; otherwise set s to the
// kern amount for the nucleus followed by the \skewchar of its font."
// Note that our skew metrics are just the kern between each character
// and the skewchar.
let skew=0;if(mustShift){// If the base is a character box, then we want the skew of the
// innermost character. To do that, we find the innermost character:
const baseChar=utils.getBaseElem(base);// Then, we render its group to get the symbol inside it
const baseGroup=buildGroup(baseChar,options.havingCrampedStyle());// Finally, we pull the skew off of the symbol.
skew=assertSymbolDomNode(baseGroup).skew;// Note that we now throw away baseGroup, because the layers we
// removed with getBaseElem might contain things like \color which
// we can't get rid of.
// TODO(emily): Find a better way to get the skew
}// calculate the amount of space between the body and the accent
let clearance=Math.min(body.height,options.fontMetrics().xHeight);// Build the accent
let accentBody;if(!group.isStretchy){let accent;let width;if(group.label==="\\vec"){// Before version 0.9, \vec used the combining font glyph U+20D7.
// But browsers, especially Safari, are not consistent in how they
// render combining characters when not preceded by a character.
// So now we use an SVG.
// If Safari reforms, we should consider reverting to the glyph.
accent=buildCommon.staticSvg("vec",options);width=buildCommon.svgData.vec[1];}else{accent=buildCommon.makeSymbol(group.label,"Main-Regular",group.mode,options);// Remove the italic correction of the accent, because it only serves to
// shift the accent over to a place we don't want.
accent.italic=0;width=accent.width;}accentBody=buildCommon.makeSpan(["accent-body"],[accent]);// "Full" accents expand the width of the resulting symbol to be
// at least the width of the accent, and overlap directly onto the
// character without any vertical offset.
const accentFull=group.label==="\\textcircled";if(accentFull){accentBody.classes.push('accent-full');clearance=body.height;}// Shift the accent over by the skew.
let left=skew;// CSS defines `.katex .accent .accent-body:not(.accent-full) { width: 0 }`
// so that the accent doesn't contribute to the bounding box.
// We need to shift the character by its width (effectively half
// its width) to compensate.
if(!accentFull){left-=width/2;}accentBody.style.left=left+"em";// \textcircled uses the \bigcirc glyph, so it needs some
// vertical adjustment to match LaTeX.
if(group.label==="\\textcircled"){accentBody.style.top=".2em";}accentBody=buildCommon.makeVList({positionType:"firstBaseline",children:[{type:"elem",elem:body},{type:"kern",size:-clearance},{type:"elem",elem:accentBody}]},options);}else{accentBody=stretchy.svgSpan(group,options);accentBody=buildCommon.makeVList({positionType:"firstBaseline",children:[{type:"elem",elem:body},{type:"elem",elem:accentBody,wrapperClasses:["svg-align"],wrapperStyle:skew>0?{width:`calc(100% - ${2*skew}em)`,marginLeft:`${2*skew}em`}:undefined}]},options);}const accentWrap=buildCommon.makeSpan(["mord","accent"],[accentBody],options);if(supSubGroup){// Here, we replace the "base" child of the supsub with our newly
// generated accent.
supSubGroup.children[0]=accentWrap;// Since we don't rerun the height calculation after replacing the
// accent, we manually recalculate height.
supSubGroup.height=Math.max(accentWrap.height,supSubGroup.height);// Accents should always be ords, even when their innards are not.
supSubGroup.classes[0]="mord";return supSubGroup;}else{return accentWrap;}};const mathmlBuilder=(group,options)=>{const accentNode=group.isStretchy?stretchy.mathMLnode(group.label):new mathMLTree.MathNode("mo",[makeText(group.label,group.mode)]);const node=new mathMLTree.MathNode("mover",[buildGroup$1(group.base,options),accentNode]);node.setAttribute("accent","true");return node;};const NON_STRETCHY_ACCENT_REGEX=new RegExp(["\\acute","\\grave","\\ddot","\\tilde","\\bar","\\breve","\\check","\\hat","\\vec","\\dot","\\mathring"].map(accent=>`\\${accent}`).join("|"));// Accents
defineFunction({type:"accent",names:["\\acute","\\grave","\\ddot","\\tilde","\\bar","\\breve","\\check","\\hat","\\vec","\\dot","\\mathring","\\widecheck","\\widehat","\\widetilde","\\overrightarrow","\\overleftarrow","\\Overrightarrow","\\overleftrightarrow","\\overgroup","\\overlinesegment","\\overleftharpoon","\\overrightharpoon"],props:{numArgs:1},handler:(context,args)=>{const base=args[0];const isStretchy=!NON_STRETCHY_ACCENT_REGEX.test(context.funcName);const isShifty=!isStretchy||context.funcName==="\\widehat"||context.funcName==="\\widetilde"||context.funcName==="\\widecheck";return {type:"accent",mode:context.parser.mode,label:context.funcName,isStretchy:isStretchy,isShifty:isShifty,base:base};},htmlBuilder,mathmlBuilder});// Text-mode accents
defineFunction({type:"accent",names:["\\'","\\`","\\^","\\~","\\=","\\u","\\.",'\\"',"\\r","\\H","\\v","\\textcircled"],props:{numArgs:1,allowedInText:true,allowedInMath:false},handler:(context,args)=>{const base=args[0];return {type:"accent",mode:context.parser.mode,label:context.funcName,isStretchy:false,isShifty:true,base:base};},htmlBuilder,mathmlBuilder});// Horizontal overlap functions
defineFunction({type:"accentUnder",names:["\\underleftarrow","\\underrightarrow","\\underleftrightarrow","\\undergroup","\\underlinesegment","\\utilde"],props:{numArgs:1},handler:(_ref,args)=>{let parser=_ref.parser,funcName=_ref.funcName;const base=args[0];return {type:"accentUnder",mode:parser.mode,label:funcName,base:base};},htmlBuilder:(group,options)=>{// Treat under accents much like underlines.
const innerGroup=buildGroup(group.base,options);const accentBody=stretchy.svgSpan(group,options);const kern=group.label==="\\utilde"?0.12:0;// Generate the vlist, with the appropriate kerns
const vlist=buildCommon.makeVList({positionType:"bottom",positionData:accentBody.height+kern,children:[{type:"elem",elem:accentBody,wrapperClasses:["svg-align"]},{type:"kern",size:kern},{type:"elem",elem:innerGroup}]},options);return buildCommon.makeSpan(["mord","accentunder"],[vlist],options);},mathmlBuilder:(group,options)=>{const accentNode=stretchy.mathMLnode(group.label);const node=new mathMLTree.MathNode("munder",[buildGroup$1(group.base,options),accentNode]);node.setAttribute("accentunder","true");return node;}});// Stretchy arrows with an optional argument
defineFunction({type:"xArrow",names:["\\xleftarrow","\\xrightarrow","\\xLeftarrow","\\xRightarrow","\\xleftrightarrow","\\xLeftrightarrow","\\xhookleftarrow","\\xhookrightarrow","\\xmapsto","\\xrightharpoondown","\\xrightharpoonup","\\xleftharpoondown","\\xleftharpoonup","\\xrightleftharpoons","\\xleftrightharpoons","\\xlongequal","\\xtwoheadrightarrow","\\xtwoheadleftarrow","\\xtofrom",// The next 3 functions are here to support the mhchem extension.
// Direct use of these functions is discouraged and may break someday.
"\\xrightleftarrows","\\xrightequilibrium","\\xleftequilibrium"],props:{numArgs:1,numOptionalArgs:1},handler(_ref,args,optArgs){let parser=_ref.parser,funcName=_ref.funcName;return {type:"xArrow",mode:parser.mode,label:funcName,body:args[0],below:optArgs[0]};},// Flow is unable to correctly infer the type of `group`, even though it's
// unamibiguously determined from the passed-in `type` above.
htmlBuilder(group,options){const style=options.style;// Build the argument groups in the appropriate style.
// Ref: amsmath.dtx:   \hbox{$\scriptstyle\mkern#3mu{#6}\mkern#4mu$}%
// Some groups can return document fragments.  Handle those by wrapping
// them in a span.
let newOptions=options.havingStyle(style.sup());const upperGroup=buildCommon.wrapFragment(buildGroup(group.body,newOptions,options),options);upperGroup.classes.push("x-arrow-pad");let lowerGroup;if(group.below){// Build the lower group
newOptions=options.havingStyle(style.sub());lowerGroup=buildCommon.wrapFragment(buildGroup(group.below,newOptions,options),options);lowerGroup.classes.push("x-arrow-pad");}const arrowBody=stretchy.svgSpan(group,options);// Re shift: Note that stretchy.svgSpan returned arrowBody.depth = 0.
// The point we want on the math axis is at 0.5 * arrowBody.height.
const arrowShift=-options.fontMetrics().axisHeight+0.5*arrowBody.height;// 2 mu kern. Ref: amsmath.dtx: #7\if0#2\else\mkern#2mu\fi
let upperShift=-options.fontMetrics().axisHeight-0.5*arrowBody.height-0.111;// 0.111 em = 2 mu
if(upperGroup.depth>0.25||group.label==="\\xleftequilibrium"){upperShift-=upperGroup.depth;// shift up if depth encroaches
}// Generate the vlist
let vlist;if(lowerGroup){const lowerShift=-options.fontMetrics().axisHeight+lowerGroup.height+0.5*arrowBody.height+0.111;vlist=buildCommon.makeVList({positionType:"individualShift",children:[{type:"elem",elem:upperGroup,shift:upperShift},{type:"elem",elem:arrowBody,shift:arrowShift},{type:"elem",elem:lowerGroup,shift:lowerShift}]},options);}else{vlist=buildCommon.makeVList({positionType:"individualShift",children:[{type:"elem",elem:upperGroup,shift:upperShift},{type:"elem",elem:arrowBody,shift:arrowShift}]},options);}// $FlowFixMe: Replace this with passing "svg-align" into makeVList.
vlist.children[0].children[0].children[1].classes.push("svg-align");return buildCommon.makeSpan(["mrel","x-arrow"],[vlist],options);},mathmlBuilder(group,options){const arrowNode=stretchy.mathMLnode(group.label);let node;let lowerNode;if(group.body){const upperNode=buildGroup$1(group.body,options);if(group.below){lowerNode=buildGroup$1(group.below,options);node=new mathMLTree.MathNode("munderover",[arrowNode,lowerNode,upperNode]);}else{node=new mathMLTree.MathNode("mover",[arrowNode,upperNode]);}}else if(group.below){lowerNode=buildGroup$1(group.below,options);node=new mathMLTree.MathNode("munder",[arrowNode,lowerNode]);}else{node=new mathMLTree.MathNode("mover",[arrowNode]);}return node;}});// {123} and converts into symbol with code 123.  It is used by the *macro*
// \char defined in macros.js.
defineFunction({type:"textord",names:["\\@char"],props:{numArgs:1,allowedInText:true},handler(_ref,args){let parser=_ref.parser;const arg=assertNodeType(args[0],"ordgroup");const group=arg.body;let number="";for(let i=0;i<group.length;i++){const node=assertNodeType(group[i],"textord");number+=node.text;}const code=parseInt(number);if(isNaN(code)){throw new ParseError(`\\@char has non-numeric argument ${number}`);}return {type:"textord",mode:parser.mode,text:String.fromCharCode(code)};}});const htmlBuilder$1=(group,options)=>{const elements=buildExpression(group.body,options.withColor(group.color),false);// \color isn't supposed to affect the type of the elements it contains.
// To accomplish this, we wrap the results in a fragment, so the inner
// elements will be able to directly interact with their neighbors. For
// example, `\color{red}{2 +} 3` has the same spacing as `2 + 3`
return buildCommon.makeFragment(elements);};const mathmlBuilder$1=(group,options)=>{const inner=buildExpression$1(group.body,options);const node=new mathMLTree.MathNode("mstyle",inner);node.setAttribute("mathcolor",group.color);return node;};defineFunction({type:"color",names:["\\textcolor"],props:{numArgs:2,allowedInText:true,greediness:3,argTypes:["color","original"]},handler(_ref,args){let parser=_ref.parser;const color=assertNodeType(args[0],"color-token").color;const body=args[1];return {type:"color",mode:parser.mode,color,body:ordargument(body)};},htmlBuilder:htmlBuilder$1,mathmlBuilder:mathmlBuilder$1});// TODO(kevinb): define these using macros
defineFunction({type:"color",names:["\\blue","\\orange","\\pink","\\red","\\green","\\gray","\\purple","\\blueA","\\blueB","\\blueC","\\blueD","\\blueE","\\tealA","\\tealB","\\tealC","\\tealD","\\tealE","\\greenA","\\greenB","\\greenC","\\greenD","\\greenE","\\goldA","\\goldB","\\goldC","\\goldD","\\goldE","\\redA","\\redB","\\redC","\\redD","\\redE","\\maroonA","\\maroonB","\\maroonC","\\maroonD","\\maroonE","\\purpleA","\\purpleB","\\purpleC","\\purpleD","\\purpleE","\\mintA","\\mintB","\\mintC","\\grayA","\\grayB","\\grayC","\\grayD","\\grayE","\\grayF","\\grayG","\\grayH","\\grayI","\\kaBlue","\\kaGreen"],props:{numArgs:1,allowedInText:true,greediness:3},handler(_ref2,args){let parser=_ref2.parser,funcName=_ref2.funcName;const body=args[0];return {type:"color",mode:parser.mode,color:"katex-"+funcName.slice(1),body:ordargument(body)};},htmlBuilder:htmlBuilder$1,mathmlBuilder:mathmlBuilder$1});defineFunction({type:"color",names:["\\color"],props:{numArgs:1,allowedInText:true,greediness:3,argTypes:["color"]},handler(_ref3,args){let parser=_ref3.parser,breakOnTokenText=_ref3.breakOnTokenText;const color=assertNodeType(args[0],"color-token").color;// If we see a styling function, parse out the implicit body
const body=parser.parseExpression(true,breakOnTokenText);return {type:"color",mode:parser.mode,color,body};},htmlBuilder:htmlBuilder$1,mathmlBuilder:mathmlBuilder$1});// Row breaks within tabular environments, and line breaks at top level
// same signature, we implement them as one megafunction, with newRow
// indicating whether we're in the \cr case, and newLine indicating whether
// to break the line in the \newline case.
defineFunction({type:"cr",names:["\\cr","\\newline"],props:{numArgs:0,numOptionalArgs:1,argTypes:["size"],allowedInText:true},handler(_ref,args,optArgs){let parser=_ref.parser,funcName=_ref.funcName;const size=optArgs[0];const newRow=funcName==="\\cr";let newLine=false;if(!newRow){if(parser.settings.displayMode&&parser.settings.useStrictBehavior("newLineInDisplayMode","In LaTeX, \\\\ or \\newline "+"does nothing in display mode")){newLine=false;}else{newLine=true;}}return {type:"cr",mode:parser.mode,newLine,newRow,size:size&&assertNodeType(size,"size").value};},// The following builders are called only at the top level,
// not within tabular/array environments.
htmlBuilder(group,options){if(group.newRow){throw new ParseError("\\cr valid only within a tabular/array environment");}const span=buildCommon.makeSpan(["mspace"],[],options);if(group.newLine){span.classes.push("newline");if(group.size){span.style.marginTop=calculateSize(group.size,options)+"em";}}return span;},mathmlBuilder(group,options){const node=new mathMLTree.MathNode("mspace");if(group.newLine){node.setAttribute("linebreak","newline");if(group.size){node.setAttribute("height",calculateSize(group.size,options)+"em");}}return node;}});/**
 * This file deals with creating delimiters of various sizes. The TeXbook
 * discusses these routines on page 441-442, in the "Another subroutine sets box
 * x to a specified variable delimiter" paragraph.
 *
 * There are three main routines here. `makeSmallDelim` makes a delimiter in the
 * normal font, but in either text, script, or scriptscript style.
 * `makeLargeDelim` makes a delimiter in textstyle, but in one of the Size1,
 * Size2, Size3, or Size4 fonts. `makeStackedDelim` makes a delimiter out of
 * smaller pieces that are stacked on top of one another.
 *
 * The functions take a parameter `center`, which determines if the delimiter
 * should be centered around the axis.
 *
 * Then, there are three exposed functions. `sizedDelim` makes a delimiter in
 * one of the given sizes. This is used for things like `\bigl`.
 * `customSizedDelim` makes a delimiter with a given total height+depth. It is
 * called in places like `\sqrt`. `leftRightDelim` makes an appropriate
 * delimiter which surrounds an expression of a given height an depth. It is
 * used in `\left` and `\right`.
 */ /**
 * Get the metrics for a given symbol and font, after transformation (i.e.
 * after following replacement from symbols.js)
 */const getMetrics=function getMetrics(symbol,font,mode){const replace=symbols.math[symbol]&&symbols.math[symbol].replace;const metrics=getCharacterMetrics(replace||symbol,font,mode);if(!metrics){throw new Error(`Unsupported symbol ${symbol} and font size ${font}.`);}return metrics;};/**
 * Puts a delimiter span in a given style, and adds appropriate height, depth,
 * and maxFontSizes.
 */const styleWrap=function styleWrap(delim,toStyle,options,classes){const newOptions=options.havingBaseStyle(toStyle);const span=buildCommon.makeSpan(classes.concat(newOptions.sizingClasses(options)),[delim],options);const delimSizeMultiplier=newOptions.sizeMultiplier/options.sizeMultiplier;span.height*=delimSizeMultiplier;span.depth*=delimSizeMultiplier;span.maxFontSize=newOptions.sizeMultiplier;return span;};const centerSpan=function centerSpan(span,options,style){const newOptions=options.havingBaseStyle(style);const shift=(1-options.sizeMultiplier/newOptions.sizeMultiplier)*options.fontMetrics().axisHeight;span.classes.push("delimcenter");span.style.top=shift+"em";span.height-=shift;span.depth+=shift;};/**
 * Makes a small delimiter. This is a delimiter that comes in the Main-Regular
 * font, but is restyled to either be in textstyle, scriptstyle, or
 * scriptscriptstyle.
 */const makeSmallDelim=function makeSmallDelim(delim,style,center,options,mode,classes){const text=buildCommon.makeSymbol(delim,"Main-Regular",mode,options);const span=styleWrap(text,style,options,classes);if(center){centerSpan(span,options,style);}return span;};/**
 * Builds a symbol in the given font size (note size is an integer)
 */const mathrmSize=function mathrmSize(value,size,mode,options){return buildCommon.makeSymbol(value,"Size"+size+"-Regular",mode,options);};/**
 * Makes a large delimiter. This is a delimiter that comes in the Size1, Size2,
 * Size3, or Size4 fonts. It is always rendered in textstyle.
 */const makeLargeDelim=function makeLargeDelim(delim,size,center,options,mode,classes){const inner=mathrmSize(delim,size,mode,options);const span=styleWrap(buildCommon.makeSpan(["delimsizing","size"+size],[inner],options),Style$1.TEXT,options,classes);if(center){centerSpan(span,options,Style$1.TEXT);}return span;};/**
 * Make an inner span with the given offset and in the given font. This is used
 * in `makeStackedDelim` to make the stacking pieces for the delimiter.
 */const makeInner=function makeInner(symbol,font,mode){let sizeClass;// Apply the correct CSS class to choose the right font.
if(font==="Size1-Regular"){sizeClass="delim-size1";}else/* if (font === "Size4-Regular") */{sizeClass="delim-size4";}const inner=buildCommon.makeSpan(["delimsizinginner",sizeClass],[buildCommon.makeSpan([],[buildCommon.makeSymbol(symbol,font,mode)])]);// Since this will be passed into `makeVList` in the end, wrap the element
// in the appropriate tag that VList uses.
return {type:"elem",elem:inner};};/**
 * Make a stacked delimiter out of a given delimiter, with the total height at
 * least `heightTotal`. This routine is mentioned on page 442 of the TeXbook.
 */const makeStackedDelim=function makeStackedDelim(delim,heightTotal,center,options,mode,classes){// There are four parts, the top, an optional middle, a repeated part, and a
// bottom.
let top;let middle;let repeat;let bottom;top=repeat=bottom=delim;middle=null;// Also keep track of what font the delimiters are in
let font="Size1-Regular";// We set the parts and font based on the symbol. Note that we use
// '\u23d0' instead of '|' and '\u2016' instead of '\\|' for the
// repeats of the arrows
if(delim==="\\uparrow"){repeat=bottom="\u23d0";}else if(delim==="\\Uparrow"){repeat=bottom="\u2016";}else if(delim==="\\downarrow"){top=repeat="\u23d0";}else if(delim==="\\Downarrow"){top=repeat="\u2016";}else if(delim==="\\updownarrow"){top="\\uparrow";repeat="\u23d0";bottom="\\downarrow";}else if(delim==="\\Updownarrow"){top="\\Uparrow";repeat="\u2016";bottom="\\Downarrow";}else if(delim==="["||delim==="\\lbrack"){top="\u23a1";repeat="\u23a2";bottom="\u23a3";font="Size4-Regular";}else if(delim==="]"||delim==="\\rbrack"){top="\u23a4";repeat="\u23a5";bottom="\u23a6";font="Size4-Regular";}else if(delim==="\\lfloor"||delim==="\u230a"){repeat=top="\u23a2";bottom="\u23a3";font="Size4-Regular";}else if(delim==="\\lceil"||delim==="\u2308"){top="\u23a1";repeat=bottom="\u23a2";font="Size4-Regular";}else if(delim==="\\rfloor"||delim==="\u230b"){repeat=top="\u23a5";bottom="\u23a6";font="Size4-Regular";}else if(delim==="\\rceil"||delim==="\u2309"){top="\u23a4";repeat=bottom="\u23a5";font="Size4-Regular";}else if(delim==="("||delim==="\\lparen"){top="\u239b";repeat="\u239c";bottom="\u239d";font="Size4-Regular";}else if(delim===")"||delim==="\\rparen"){top="\u239e";repeat="\u239f";bottom="\u23a0";font="Size4-Regular";}else if(delim==="\\{"||delim==="\\lbrace"){top="\u23a7";middle="\u23a8";bottom="\u23a9";repeat="\u23aa";font="Size4-Regular";}else if(delim==="\\}"||delim==="\\rbrace"){top="\u23ab";middle="\u23ac";bottom="\u23ad";repeat="\u23aa";font="Size4-Regular";}else if(delim==="\\lgroup"||delim==="\u27ee"){top="\u23a7";bottom="\u23a9";repeat="\u23aa";font="Size4-Regular";}else if(delim==="\\rgroup"||delim==="\u27ef"){top="\u23ab";bottom="\u23ad";repeat="\u23aa";font="Size4-Regular";}else if(delim==="\\lmoustache"||delim==="\u23b0"){top="\u23a7";bottom="\u23ad";repeat="\u23aa";font="Size4-Regular";}else if(delim==="\\rmoustache"||delim==="\u23b1"){top="\u23ab";bottom="\u23a9";repeat="\u23aa";font="Size4-Regular";}// Get the metrics of the four sections
const topMetrics=getMetrics(top,font,mode);const topHeightTotal=topMetrics.height+topMetrics.depth;const repeatMetrics=getMetrics(repeat,font,mode);const repeatHeightTotal=repeatMetrics.height+repeatMetrics.depth;const bottomMetrics=getMetrics(bottom,font,mode);const bottomHeightTotal=bottomMetrics.height+bottomMetrics.depth;let middleHeightTotal=0;let middleFactor=1;if(middle!==null){const middleMetrics=getMetrics(middle,font,mode);middleHeightTotal=middleMetrics.height+middleMetrics.depth;middleFactor=2;// repeat symmetrically above and below middle
}// Calcuate the minimal height that the delimiter can have.
// It is at least the size of the top, bottom, and optional middle combined.
const minHeight=topHeightTotal+bottomHeightTotal+middleHeightTotal;// Compute the number of copies of the repeat symbol we will need
const repeatCount=Math.ceil((heightTotal-minHeight)/(middleFactor*repeatHeightTotal));// Compute the total height of the delimiter including all the symbols
const realHeightTotal=minHeight+repeatCount*middleFactor*repeatHeightTotal;// The center of the delimiter is placed at the center of the axis. Note
// that in this context, "center" means that the delimiter should be
// centered around the axis in the current style, while normally it is
// centered around the axis in textstyle.
let axisHeight=options.fontMetrics().axisHeight;if(center){axisHeight*=options.sizeMultiplier;}// Calculate the depth
const depth=realHeightTotal/2-axisHeight;// Now, we start building the pieces that will go into the vlist
// Keep a list of the inner pieces
const inners=[];// Add the bottom symbol
inners.push(makeInner(bottom,font,mode));if(middle===null){// Add that many symbols
for(let i=0;i<repeatCount;i++){inners.push(makeInner(repeat,font,mode));}}else{// When there is a middle bit, we need the middle part and two repeated
// sections
for(let i=0;i<repeatCount;i++){inners.push(makeInner(repeat,font,mode));}inners.push(makeInner(middle,font,mode));for(let i=0;i<repeatCount;i++){inners.push(makeInner(repeat,font,mode));}}// Add the top symbol
inners.push(makeInner(top,font,mode));// Finally, build the vlist
const newOptions=options.havingBaseStyle(Style$1.TEXT);const inner=buildCommon.makeVList({positionType:"bottom",positionData:depth,children:inners},newOptions);return styleWrap(buildCommon.makeSpan(["delimsizing","mult"],[inner],newOptions),Style$1.TEXT,options,classes);};// All surds have 0.08em padding above the viniculum inside the SVG.
// That keeps browser span height rounding error from pinching the line.
const vbPad=80;// padding above the surd, measured inside the viewBox.
const emPad=0.08;// padding, in ems, measured in the document.
const sqrtSvg=function sqrtSvg(sqrtName,height,viewBoxHeight,options){let alternate;if(sqrtName==="sqrtTall"){// sqrtTall is from glyph U23B7 in the font KaTeX_Size4-Regular
// One path edge has a variable length. It runs from the viniculumn
// to a point near (14 units) the bottom of the surd. The viniculum
// is 40 units thick. So the length of the line in question is:
const vertSegment=viewBoxHeight-54-vbPad;alternate=`M702 ${vbPad}H400000v40H742v${vertSegment}l-4 4-4 4c-.667.7
-2 1.5-4 2.5s-4.167 1.833-6.5 2.5-5.5 1-9.5 1h-12l-28-84c-16.667-52-96.667
-294.333-240-727l-212 -643 -85 170c-4-3.333-8.333-7.667-13 -13l-13-13l77-155
 77-156c66 199.333 139 419.667 219 661 l218 661zM702 ${vbPad}H400000v40H742z`;}const pathNode=new PathNode(sqrtName,alternate);const svg=new SvgNode([pathNode],{// Note: 1000:1 ratio of viewBox to document em width.
"width":"400em","height":height+"em","viewBox":"0 0 400000 "+viewBoxHeight,"preserveAspectRatio":"xMinYMin slice"});return buildCommon.makeSvgSpan(["hide-tail"],[svg],options);};/**
 * Make a sqrt image of the given height,
 */const makeSqrtImage=function makeSqrtImage(height,options){// Define a newOptions that removes the effect of size changes such as \Huge.
// We don't pick different a height surd for \Huge. For it, we scale up.
const newOptions=options.havingBaseSizing();// Pick the desired surd glyph from a sequence of surds.
const delim=traverseSequence("\\surd",height*newOptions.sizeMultiplier,stackLargeDelimiterSequence,newOptions);let sizeMultiplier=newOptions.sizeMultiplier;// default
// Create a span containing an SVG image of a sqrt symbol.
let span;let spanHeight=0;let texHeight=0;let viewBoxHeight=0;let advanceWidth;// We create viewBoxes with 80 units of "padding" above each surd.
// Then browser rounding error on the parent span height will not
// encroach on the ink of the viniculum. But that padding is not
// included in the TeX-like `height` used for calculation of
// vertical alignment. So texHeight = span.height < span.style.height.
if(delim.type==="small"){// Get an SVG that is derived from glyph U+221A in font KaTeX-Main.
viewBoxHeight=1000+vbPad;// 1000 unit glyph height.
if(height<1.0){sizeMultiplier=1.0;// mimic a \textfont radical
}else if(height<1.4){sizeMultiplier=0.7;// mimic a \scriptfont radical
}spanHeight=(1.0+emPad)/sizeMultiplier;texHeight=1.00/sizeMultiplier;span=sqrtSvg("sqrtMain",spanHeight,viewBoxHeight,options);span.style.minWidth="0.853em";advanceWidth=0.833/sizeMultiplier;// from the font.
}else if(delim.type==="large"){// These SVGs come from fonts: KaTeX_Size1, _Size2, etc.
viewBoxHeight=(1000+vbPad)*sizeToMaxHeight[delim.size];texHeight=sizeToMaxHeight[delim.size]/sizeMultiplier;spanHeight=(sizeToMaxHeight[delim.size]+emPad)/sizeMultiplier;span=sqrtSvg("sqrtSize"+delim.size,spanHeight,viewBoxHeight,options);span.style.minWidth="1.02em";advanceWidth=1.0/sizeMultiplier;// 1.0 from the font.
}else{// Tall sqrt. In TeX, this would be stacked using multiple glyphs.
// We'll use a single SVG to accomplish the same thing.
spanHeight=height+emPad;texHeight=height;viewBoxHeight=Math.floor(1000*height)+vbPad;span=sqrtSvg("sqrtTall",spanHeight,viewBoxHeight,options);span.style.minWidth="0.742em";advanceWidth=1.056;}span.height=texHeight;span.style.height=spanHeight+"em";return {span,advanceWidth,// Calculate the actual line width.
// This actually should depend on the chosen font -- e.g. \boldmath
// should use the thicker surd symbols from e.g. KaTeX_Main-Bold, and
// have thicker rules.
ruleWidth:options.fontMetrics().sqrtRuleThickness*sizeMultiplier};};// There are three kinds of delimiters, delimiters that stack when they become
// too large
const stackLargeDelimiters=["(","\\lparen",")","\\rparen","[","\\lbrack","]","\\rbrack","\\{","\\lbrace","\\}","\\rbrace","\\lfloor","\\rfloor","\u230a","\u230b","\\lceil","\\rceil","\u2308","\u2309","\\surd"];// delimiters that always stack
const stackAlwaysDelimiters=["\\uparrow","\\downarrow","\\updownarrow","\\Uparrow","\\Downarrow","\\Updownarrow","|","\\|","\\vert","\\Vert","\\lvert","\\rvert","\\lVert","\\rVert","\\lgroup","\\rgroup","\u27ee","\u27ef","\\lmoustache","\\rmoustache","\u23b0","\u23b1"];// and delimiters that never stack
const stackNeverDelimiters=["<",">","\\langle","\\rangle","/","\\backslash","\\lt","\\gt"];// Metrics of the different sizes. Found by looking at TeX's output of
// $\bigl| // \Bigl| \biggl| \Biggl| \showlists$
// Used to create stacked delimiters of appropriate sizes in makeSizedDelim.
const sizeToMaxHeight=[0,1.2,1.8,2.4,3.0];/**
 * Used to create a delimiter of a specific size, where `size` is 1, 2, 3, or 4.
 */const makeSizedDelim=function makeSizedDelim(delim,size,options,mode,classes){// < and > turn into \langle and \rangle in delimiters
if(delim==="<"||delim==="\\lt"||delim==="\u27e8"){delim="\\langle";}else if(delim===">"||delim==="\\gt"||delim==="\u27e9"){delim="\\rangle";}// Sized delimiters are never centered.
if(utils.contains(stackLargeDelimiters,delim)||utils.contains(stackNeverDelimiters,delim)){return makeLargeDelim(delim,size,false,options,mode,classes);}else if(utils.contains(stackAlwaysDelimiters,delim)){return makeStackedDelim(delim,sizeToMaxHeight[size],false,options,mode,classes);}else{throw new ParseError("Illegal delimiter: '"+delim+"'");}};/**
 * There are three different sequences of delimiter sizes that the delimiters
 * follow depending on the kind of delimiter. This is used when creating custom
 * sized delimiters to decide whether to create a small, large, or stacked
 * delimiter.
 *
 * In real TeX, these sequences aren't explicitly defined, but are instead
 * defined inside the font metrics. Since there are only three sequences that
 * are possible for the delimiters that TeX defines, it is easier to just encode
 * them explicitly here.
 */ // Delimiters that never stack try small delimiters and large delimiters only
const stackNeverDelimiterSequence=[{type:"small",style:Style$1.SCRIPTSCRIPT},{type:"small",style:Style$1.SCRIPT},{type:"small",style:Style$1.TEXT},{type:"large",size:1},{type:"large",size:2},{type:"large",size:3},{type:"large",size:4}];// Delimiters that always stack try the small delimiters first, then stack
const stackAlwaysDelimiterSequence=[{type:"small",style:Style$1.SCRIPTSCRIPT},{type:"small",style:Style$1.SCRIPT},{type:"small",style:Style$1.TEXT},{type:"stack"}];// Delimiters that stack when large try the small and then large delimiters, and
// stack afterwards
const stackLargeDelimiterSequence=[{type:"small",style:Style$1.SCRIPTSCRIPT},{type:"small",style:Style$1.SCRIPT},{type:"small",style:Style$1.TEXT},{type:"large",size:1},{type:"large",size:2},{type:"large",size:3},{type:"large",size:4},{type:"stack"}];/**
 * Get the font used in a delimiter based on what kind of delimiter it is.
 * TODO(#963) Use more specific font family return type once that is introduced.
 */const delimTypeToFont=function delimTypeToFont(type){if(type.type==="small"){return "Main-Regular";}else if(type.type==="large"){return "Size"+type.size+"-Regular";}else if(type.type==="stack"){return "Size4-Regular";}else{throw new Error(`Add support for delim type '${type.type}' here.`);}};/**
 * Traverse a sequence of types of delimiters to decide what kind of delimiter
 * should be used to create a delimiter of the given height+depth.
 */const traverseSequence=function traverseSequence(delim,height,sequence,options){// Here, we choose the index we should start at in the sequences. In smaller
// sizes (which correspond to larger numbers in style.size) we start earlier
// in the sequence. Thus, scriptscript starts at index 3-3=0, script starts
// at index 3-2=1, text starts at 3-1=2, and display starts at min(2,3-0)=2
const start=Math.min(2,3-options.style.size);for(let i=start;i<sequence.length;i++){if(sequence[i].type==="stack"){// This is always the last delimiter, so we just break the loop now.
break;}const metrics=getMetrics(delim,delimTypeToFont(sequence[i]),"math");let heightDepth=metrics.height+metrics.depth;// Small delimiters are scaled down versions of the same font, so we
// account for the style change size.
if(sequence[i].type==="small"){const newOptions=options.havingBaseStyle(sequence[i].style);heightDepth*=newOptions.sizeMultiplier;}// Check if the delimiter at this size works for the given height.
if(heightDepth>height){return sequence[i];}}// If we reached the end of the sequence, return the last sequence element.
return sequence[sequence.length-1];};/**
 * Make a delimiter of a given height+depth, with optional centering. Here, we
 * traverse the sequences, and create a delimiter that the sequence tells us to.
 */const makeCustomSizedDelim=function makeCustomSizedDelim(delim,height,center,options,mode,classes){if(delim==="<"||delim==="\\lt"||delim==="\u27e8"){delim="\\langle";}else if(delim===">"||delim==="\\gt"||delim==="\u27e9"){delim="\\rangle";}// Decide what sequence to use
let sequence;if(utils.contains(stackNeverDelimiters,delim)){sequence=stackNeverDelimiterSequence;}else if(utils.contains(stackLargeDelimiters,delim)){sequence=stackLargeDelimiterSequence;}else{sequence=stackAlwaysDelimiterSequence;}// Look through the sequence
const delimType=traverseSequence(delim,height,sequence,options);// Get the delimiter from font glyphs.
// Depending on the sequence element we decided on, call the
// appropriate function.
if(delimType.type==="small"){return makeSmallDelim(delim,delimType.style,center,options,mode,classes);}else if(delimType.type==="large"){return makeLargeDelim(delim,delimType.size,center,options,mode,classes);}else/* if (delimType.type === "stack") */{return makeStackedDelim(delim,height,center,options,mode,classes);}};/**
 * Make a delimiter for use with `\left` and `\right`, given a height and depth
 * of an expression that the delimiters surround.
 */const makeLeftRightDelim=function makeLeftRightDelim(delim,height,depth,options,mode,classes){// We always center \left/\right delimiters, so the axis is always shifted
const axisHeight=options.fontMetrics().axisHeight*options.sizeMultiplier;// Taken from TeX source, tex.web, function make_left_right
const delimiterFactor=901;const delimiterExtend=5.0/options.fontMetrics().ptPerEm;const maxDistFromAxis=Math.max(height-axisHeight,depth+axisHeight);const totalHeight=Math.max(// In real TeX, calculations are done using integral values which are
// 65536 per pt, or 655360 per em. So, the division here truncates in
// TeX but doesn't here, producing different results. If we wanted to
// exactly match TeX's calculation, we could do
//   Math.floor(655360 * maxDistFromAxis / 500) *
//    delimiterFactor / 655360
// (To see the difference, compare
//    x^{x^{\left(\rule{0.1em}{0.68em}\right)}}
// in TeX and KaTeX)
maxDistFromAxis/500*delimiterFactor,2*maxDistFromAxis-delimiterExtend);// Finally, we defer to `makeCustomSizedDelim` with our calculated total
// height
return makeCustomSizedDelim(delim,totalHeight,true,options,mode,classes);};var delimiter={sqrtImage:makeSqrtImage,sizedDelim:makeSizedDelim,customSizedDelim:makeCustomSizedDelim,leftRightDelim:makeLeftRightDelim};// Extra data needed for the delimiter handler down below
const delimiterSizes={"\\bigl":{mclass:"mopen",size:1},"\\Bigl":{mclass:"mopen",size:2},"\\biggl":{mclass:"mopen",size:3},"\\Biggl":{mclass:"mopen",size:4},"\\bigr":{mclass:"mclose",size:1},"\\Bigr":{mclass:"mclose",size:2},"\\biggr":{mclass:"mclose",size:3},"\\Biggr":{mclass:"mclose",size:4},"\\bigm":{mclass:"mrel",size:1},"\\Bigm":{mclass:"mrel",size:2},"\\biggm":{mclass:"mrel",size:3},"\\Biggm":{mclass:"mrel",size:4},"\\big":{mclass:"mord",size:1},"\\Big":{mclass:"mord",size:2},"\\bigg":{mclass:"mord",size:3},"\\Bigg":{mclass:"mord",size:4}};const delimiters=["(","\\lparen",")","\\rparen","[","\\lbrack","]","\\rbrack","\\{","\\lbrace","\\}","\\rbrace","\\lfloor","\\rfloor","\u230a","\u230b","\\lceil","\\rceil","\u2308","\u2309","<",">","\\langle","\u27e8","\\rangle","\u27e9","\\lt","\\gt","\\lvert","\\rvert","\\lVert","\\rVert","\\lgroup","\\rgroup","\u27ee","\u27ef","\\lmoustache","\\rmoustache","\u23b0","\u23b1","/","\\backslash","|","\\vert","\\|","\\Vert","\\uparrow","\\Uparrow","\\downarrow","\\Downarrow","\\updownarrow","\\Updownarrow","."];// Delimiter functions
function checkDelimiter(delim,context){const symDelim=checkSymbolNodeType(delim);if(symDelim&&utils.contains(delimiters,symDelim.text)){return symDelim;}else{throw new ParseError("Invalid delimiter: '"+(symDelim?symDelim.text:JSON.stringify(delim))+"' after '"+context.funcName+"'",delim);}}defineFunction({type:"delimsizing",names:["\\bigl","\\Bigl","\\biggl","\\Biggl","\\bigr","\\Bigr","\\biggr","\\Biggr","\\bigm","\\Bigm","\\biggm","\\Biggm","\\big","\\Big","\\bigg","\\Bigg"],props:{numArgs:1},handler:(context,args)=>{const delim=checkDelimiter(args[0],context);return {type:"delimsizing",mode:context.parser.mode,size:delimiterSizes[context.funcName].size,mclass:delimiterSizes[context.funcName].mclass,delim:delim.text};},htmlBuilder:(group,options)=>{if(group.delim==="."){// Empty delimiters still count as elements, even though they don't
// show anything.
return buildCommon.makeSpan([group.mclass]);}// Use delimiter.sizedDelim to generate the delimiter.
return delimiter.sizedDelim(group.delim,group.size,options,group.mode,[group.mclass]);},mathmlBuilder:group=>{const children=[];if(group.delim!=="."){children.push(makeText(group.delim,group.mode));}const node=new mathMLTree.MathNode("mo",children);if(group.mclass==="mopen"||group.mclass==="mclose"){// Only some of the delimsizing functions act as fences, and they
// return "mopen" or "mclose" mclass.
node.setAttribute("fence","true");}else{// Explicitly disable fencing if it's not a fence, to override the
// defaults.
node.setAttribute("fence","false");}return node;}});function assertParsed(group){if(!group.body){throw new Error("Bug: The leftright ParseNode wasn't fully parsed.");}}defineFunction({type:"leftright-right",names:["\\right"],props:{numArgs:1},handler:(context,args)=>{// \left case below triggers parsing of \right in
//   `const right = parser.parseFunction();`
// uses this return value.
return {type:"leftright-right",mode:context.parser.mode,delim:checkDelimiter(args[0],context).text};}});defineFunction({type:"leftright",names:["\\left"],props:{numArgs:1},handler:(context,args)=>{const delim=checkDelimiter(args[0],context);const parser=context.parser;// Parse out the implicit body
++parser.leftrightDepth;// parseExpression stops before '\\right'
const body=parser.parseExpression(false);--parser.leftrightDepth;// Check the next token
parser.expect("\\right",false);const right=assertNodeType(parser.parseFunction(),"leftright-right");return {type:"leftright",mode:parser.mode,body,left:delim.text,right:right.delim};},htmlBuilder:(group,options)=>{assertParsed(group);// Build the inner expression
const inner=buildExpression(group.body,options,true,["mopen","mclose"]);let innerHeight=0;let innerDepth=0;let hadMiddle=false;// Calculate its height and depth
for(let i=0;i<inner.length;i++){// Property `isMiddle` not defined on `span`. See comment in
// "middle"'s htmlBuilder.
// $FlowFixMe
if(inner[i].isMiddle){hadMiddle=true;}else{innerHeight=Math.max(inner[i].height,innerHeight);innerDepth=Math.max(inner[i].depth,innerDepth);}}// The size of delimiters is the same, regardless of what style we are
// in. Thus, to correctly calculate the size of delimiter we need around
// a group, we scale down the inner size based on the size.
innerHeight*=options.sizeMultiplier;innerDepth*=options.sizeMultiplier;let leftDelim;if(group.left==="."){// Empty delimiters in \left and \right make null delimiter spaces.
leftDelim=makeNullDelimiter(options,["mopen"]);}else{// Otherwise, use leftRightDelim to generate the correct sized
// delimiter.
leftDelim=delimiter.leftRightDelim(group.left,innerHeight,innerDepth,options,group.mode,["mopen"]);}// Add it to the beginning of the expression
inner.unshift(leftDelim);// Handle middle delimiters
if(hadMiddle){for(let i=1;i<inner.length;i++){const middleDelim=inner[i];// Property `isMiddle` not defined on `span`. See comment in
// "middle"'s htmlBuilder.
// $FlowFixMe
const isMiddle=middleDelim.isMiddle;if(isMiddle){// Apply the options that were active when \middle was called
inner[i]=delimiter.leftRightDelim(isMiddle.delim,innerHeight,innerDepth,isMiddle.options,group.mode,[]);}}}let rightDelim;// Same for the right delimiter
if(group.right==="."){rightDelim=makeNullDelimiter(options,["mclose"]);}else{rightDelim=delimiter.leftRightDelim(group.right,innerHeight,innerDepth,options,group.mode,["mclose"]);}// Add it to the end of the expression.
inner.push(rightDelim);return buildCommon.makeSpan(["minner"],inner,options);},mathmlBuilder:(group,options)=>{assertParsed(group);const inner=buildExpression$1(group.body,options);if(group.left!=="."){const leftNode=new mathMLTree.MathNode("mo",[makeText(group.left,group.mode)]);leftNode.setAttribute("fence","true");inner.unshift(leftNode);}if(group.right!=="."){const rightNode=new mathMLTree.MathNode("mo",[makeText(group.right,group.mode)]);rightNode.setAttribute("fence","true");inner.push(rightNode);}return makeRow(inner);}});defineFunction({type:"middle",names:["\\middle"],props:{numArgs:1},handler:(context,args)=>{const delim=checkDelimiter(args[0],context);if(!context.parser.leftrightDepth){throw new ParseError("\\middle without preceding \\left",delim);}return {type:"middle",mode:context.parser.mode,delim:delim.text};},htmlBuilder:(group,options)=>{let middleDelim;if(group.delim==="."){middleDelim=makeNullDelimiter(options,[]);}else{middleDelim=delimiter.sizedDelim(group.delim,1,options,group.mode,[]);const isMiddle={delim:group.delim,options};// Property `isMiddle` not defined on `span`. It is only used in
// this file above.
// TODO: Fix this violation of the `span` type and possibly rename
// things since `isMiddle` sounds like a boolean, but is a struct.
// $FlowFixMe
middleDelim.isMiddle=isMiddle;}return middleDelim;},mathmlBuilder:(group,options)=>{const middleNode=new mathMLTree.MathNode("mo",[makeText(group.delim,group.mode)]);middleNode.setAttribute("fence","true");return middleNode;}});const htmlBuilder$2=(group,options)=>{// \cancel, \bcancel, \xcancel, \sout, \fbox, \colorbox, \fcolorbox
// Some groups can return document fragments.  Handle those by wrapping
// them in a span.
const inner=buildCommon.wrapFragment(buildGroup(group.body,options),options);const label=group.label.substr(1);const scale=options.sizeMultiplier;let img;let imgShift=0;// In the LaTeX cancel package, line geometry is slightly different
// depending on whether the subject is wider than it is tall, or vice versa.
// We don't know the width of a group, so as a proxy, we test if
// the subject is a single character. This captures most of the
// subjects that should get the "tall" treatment.
const isSingleChar=utils.isCharacterBox(group.body);if(label==="sout"){img=buildCommon.makeSpan(["stretchy","sout"]);img.height=options.fontMetrics().defaultRuleThickness/scale;imgShift=-0.5*options.fontMetrics().xHeight;}else{// Add horizontal padding
if(/cancel/.test(label)){if(!isSingleChar){inner.classes.push("cancel-pad");}}else{inner.classes.push("boxpad");}// Add vertical padding
let vertPad=0;// ref: LaTeX source2e: \fboxsep = 3pt;  \fboxrule = .4pt
// ref: cancel package: \advance\totalheight2\p@ % "+2"
if(/box/.test(label)){vertPad=label==="colorbox"?0.3:0.34;}else{vertPad=isSingleChar?0.2:0;}img=stretchy.encloseSpan(inner,label,vertPad,options);imgShift=inner.depth+vertPad;if(group.backgroundColor){img.style.backgroundColor=group.backgroundColor;if(group.borderColor){img.style.borderColor=group.borderColor;}}}let vlist;if(group.backgroundColor){vlist=buildCommon.makeVList({positionType:"individualShift",children:[// Put the color background behind inner;
{type:"elem",elem:img,shift:imgShift},{type:"elem",elem:inner,shift:0}]},options);}else{vlist=buildCommon.makeVList({positionType:"individualShift",children:[// Write the \cancel stroke on top of inner.
{type:"elem",elem:inner,shift:0},{type:"elem",elem:img,shift:imgShift,wrapperClasses:/cancel/.test(label)?["svg-align"]:[]}]},options);}if(/cancel/.test(label)){// The cancel package documentation says that cancel lines add their height
// to the expression, but tests show that isn't how it actually works.
vlist.height=inner.height;vlist.depth=inner.depth;}if(/cancel/.test(label)&&!isSingleChar){// cancel does not create horiz space for its line extension.
return buildCommon.makeSpan(["mord","cancel-lap"],[vlist],options);}else{return buildCommon.makeSpan(["mord"],[vlist],options);}};const mathmlBuilder$2=(group,options)=>{const node=new mathMLTree.MathNode("menclose",[buildGroup$1(group.body,options)]);switch(group.label){case"\\cancel":node.setAttribute("notation","updiagonalstrike");break;case"\\bcancel":node.setAttribute("notation","downdiagonalstrike");break;case"\\sout":node.setAttribute("notation","horizontalstrike");break;case"\\fbox":node.setAttribute("notation","box");break;case"\\fcolorbox":// TODO(ron): I don't know any way to set the border color.
node.setAttribute("notation","box");break;case"\\xcancel":node.setAttribute("notation","updiagonalstrike downdiagonalstrike");break;}if(group.backgroundColor){node.setAttribute("mathbackground",group.backgroundColor);}return node;};defineFunction({type:"enclose",names:["\\colorbox"],props:{numArgs:2,allowedInText:true,greediness:3,argTypes:["color","text"]},handler(_ref,args,optArgs){let parser=_ref.parser,funcName=_ref.funcName;const color=assertNodeType(args[0],"color-token").color;const body=args[1];return {type:"enclose",mode:parser.mode,label:funcName,backgroundColor:color,body};},htmlBuilder:htmlBuilder$2,mathmlBuilder:mathmlBuilder$2});defineFunction({type:"enclose",names:["\\fcolorbox"],props:{numArgs:3,allowedInText:true,greediness:3,argTypes:["color","color","text"]},handler(_ref2,args,optArgs){let parser=_ref2.parser,funcName=_ref2.funcName;const borderColor=assertNodeType(args[0],"color-token").color;const backgroundColor=assertNodeType(args[1],"color-token").color;const body=args[2];return {type:"enclose",mode:parser.mode,label:funcName,backgroundColor,borderColor,body};},htmlBuilder:htmlBuilder$2,mathmlBuilder:mathmlBuilder$2});defineFunction({type:"enclose",names:["\\fbox"],props:{numArgs:1,argTypes:["text"],allowedInText:true},handler(_ref3,args){let parser=_ref3.parser;return {type:"enclose",mode:parser.mode,label:"\\fbox",body:args[0]};}});defineFunction({type:"enclose",names:["\\cancel","\\bcancel","\\xcancel","\\sout"],props:{numArgs:1},handler(_ref4,args,optArgs){let parser=_ref4.parser,funcName=_ref4.funcName;const body=args[0];return {type:"enclose",mode:parser.mode,label:funcName,body};},htmlBuilder:htmlBuilder$2,mathmlBuilder:mathmlBuilder$2});/**
 * All registered environments.
 * `environments.js` exports this same dictionary again and makes it public.
 * `Parser.js` requires this dictionary via `environments.js`.
 */const _environments={};function defineEnvironment(_ref){let type=_ref.type,names=_ref.names,props=_ref.props,handler=_ref.handler,htmlBuilder=_ref.htmlBuilder,mathmlBuilder=_ref.mathmlBuilder;// Set default values of environments.
const data={type,numArgs:props.numArgs||0,greediness:1,allowedInText:false,numOptionalArgs:0,handler};for(let i=0;i<names.length;++i){// TODO: The value type of _environments should be a type union of all
// possible `EnvSpec<>` possibilities instead of `EnvSpec<*>`, which is
// an existential type.
// $FlowFixMe
_environments[names[i]]=data;}if(htmlBuilder){_htmlGroupBuilders[type]=htmlBuilder;}if(mathmlBuilder){_mathmlGroupBuilders[type]=mathmlBuilder;}}function getHLines(parser){// Return an array. The array length = number of hlines.
// Each element in the array tells if the line is dashed.
const hlineInfo=[];parser.consumeSpaces();let nxt=parser.nextToken.text;while(nxt==="\\hline"||nxt==="\\hdashline"){parser.consume();hlineInfo.push(nxt==="\\hdashline");parser.consumeSpaces();nxt=parser.nextToken.text;}return hlineInfo;}/**
 * Parse the body of the environment, with rows delimited by \\ and
 * columns delimited by &, and create a nested list in row-major order
 * with one group per cell.  If given an optional argument style
 * ("text", "display", etc.), then each cell is cast into that style.
 */function parseArray(parser,_ref,style){let hskipBeforeAndAfter=_ref.hskipBeforeAndAfter,addJot=_ref.addJot,cols=_ref.cols,arraystretch=_ref.arraystretch;// Parse body of array with \\ temporarily mapped to \cr
parser.gullet.beginGroup();parser.gullet.macros.set("\\\\","\\cr");// Get current arraystretch if it's not set by the environment
if(!arraystretch){const stretch=parser.gullet.expandMacroAsText("\\arraystretch");if(stretch==null){// Default \arraystretch from lttab.dtx
arraystretch=1;}else{arraystretch=parseFloat(stretch);if(!arraystretch||arraystretch<0){throw new ParseError(`Invalid \\arraystretch: ${stretch}`);}}}let row=[];const body=[row];const rowGaps=[];const hLinesBeforeRow=[];// Test for \hline at the top of the array.
hLinesBeforeRow.push(getHLines(parser));while(true){// eslint-disable-line no-constant-condition
let cell=parser.parseExpression(false,"\\cr");cell={type:"ordgroup",mode:parser.mode,body:cell};if(style){cell={type:"styling",mode:parser.mode,style,body:[cell]};}row.push(cell);const next=parser.nextToken.text;if(next==="&"){parser.consume();}else if(next==="\\end"){// Arrays terminate newlines with `\crcr` which consumes a `\cr` if
// the last line is empty.
// NOTE: Currently, `cell` is the last item added into `row`.
if(row.length===1&&cell.type==="styling"&&cell.body[0].body.length===0){body.pop();}if(hLinesBeforeRow.length<body.length+1){hLinesBeforeRow.push([]);}break;}else if(next==="\\cr"){const cr=assertNodeType(parser.parseFunction(),"cr");rowGaps.push(cr.size);// check for \hline(s) following the row separator
hLinesBeforeRow.push(getHLines(parser));row=[];body.push(row);}else{throw new ParseError("Expected & or \\\\ or \\cr or \\end",parser.nextToken);}}parser.gullet.endGroup();return {type:"array",mode:parser.mode,addJot,arraystretch,body,cols,rowGaps,hskipBeforeAndAfter,hLinesBeforeRow};}// Decides on a style for cells in an array according to whether the given
// environment name starts with the letter 'd'.
function dCellStyle(envName){if(envName.substr(0,1)==="d"){return "display";}else{return "text";}}const htmlBuilder$3=function htmlBuilder(group,options){let r;let c;const nr=group.body.length;const hLinesBeforeRow=group.hLinesBeforeRow;let nc=0;let body=new Array(nr);const hlines=[];// Horizontal spacing
const pt=1/options.fontMetrics().ptPerEm;const arraycolsep=5*pt;// \arraycolsep in article.cls
// Vertical spacing
const baselineskip=12*pt;// see size10.clo
// Default \jot from ltmath.dtx
// TODO(edemaine): allow overriding \jot via \setlength (#687)
const jot=3*pt;const arrayskip=group.arraystretch*baselineskip;const arstrutHeight=0.7*arrayskip;// \strutbox in ltfsstrc.dtx and
const arstrutDepth=0.3*arrayskip;// \@arstrutbox in lttab.dtx
let totalHeight=0;// Set a position for \hline(s) at the top of the array, if any.
function setHLinePos(hlinesInGap){for(let i=0;i<hlinesInGap.length;++i){if(i>0){totalHeight+=0.25;}hlines.push({pos:totalHeight,isDashed:hlinesInGap[i]});}}setHLinePos(hLinesBeforeRow[0]);for(r=0;r<group.body.length;++r){const inrow=group.body[r];let height=arstrutHeight;// \@array adds an \@arstrut
let depth=arstrutDepth;// to each tow (via the template)
if(nc<inrow.length){nc=inrow.length;}const outrow=new Array(inrow.length);for(c=0;c<inrow.length;++c){const elt=buildGroup(inrow[c],options);if(depth<elt.depth){depth=elt.depth;}if(height<elt.height){height=elt.height;}outrow[c]=elt;}const rowGap=group.rowGaps[r];let gap=0;if(rowGap){gap=calculateSize(rowGap,options);if(gap>0){// \@argarraycr
gap+=arstrutDepth;if(depth<gap){depth=gap;// \@xargarraycr
}gap=0;}}// In AMS multiline environments such as aligned and gathered, rows
// correspond to lines that have additional \jot added to the
// \baselineskip via \openup.
if(group.addJot){depth+=jot;}outrow.height=height;outrow.depth=depth;totalHeight+=height;outrow.pos=totalHeight;totalHeight+=depth+gap;// \@yargarraycr
body[r]=outrow;// Set a position for \hline(s), if any.
setHLinePos(hLinesBeforeRow[r+1]);}const offset=totalHeight/2+options.fontMetrics().axisHeight;const colDescriptions=group.cols||[];const cols=[];let colSep;let colDescrNum;for(c=0,colDescrNum=0;// Continue while either there are more columns or more column
// descriptions, so trailing separators don't get lost.
c<nc||colDescrNum<colDescriptions.length;++c,++colDescrNum){let colDescr=colDescriptions[colDescrNum]||{};let firstSeparator=true;while(colDescr.type==="separator"){// If there is more than one separator in a row, add a space
// between them.
if(!firstSeparator){colSep=buildCommon.makeSpan(["arraycolsep"],[]);colSep.style.width=options.fontMetrics().doubleRuleSep+"em";cols.push(colSep);}if(colDescr.separator==="|"){const separator=buildCommon.makeSpan(["vertical-separator"],[],options);separator.style.height=totalHeight+"em";separator.style.verticalAlign=-(totalHeight-offset)+"em";cols.push(separator);}else if(colDescr.separator===":"){const separator=buildCommon.makeSpan(["vertical-separator","vs-dashed"],[],options);separator.style.height=totalHeight+"em";separator.style.verticalAlign=-(totalHeight-offset)+"em";cols.push(separator);}else{throw new ParseError("Invalid separator type: "+colDescr.separator);}colDescrNum++;colDescr=colDescriptions[colDescrNum]||{};firstSeparator=false;}if(c>=nc){continue;}let sepwidth;if(c>0||group.hskipBeforeAndAfter){sepwidth=utils.deflt(colDescr.pregap,arraycolsep);if(sepwidth!==0){colSep=buildCommon.makeSpan(["arraycolsep"],[]);colSep.style.width=sepwidth+"em";cols.push(colSep);}}let col=[];for(r=0;r<nr;++r){const row=body[r];const elem=row[c];if(!elem){continue;}const shift=row.pos-offset;elem.depth=row.depth;elem.height=row.height;col.push({type:"elem",elem:elem,shift:shift});}col=buildCommon.makeVList({positionType:"individualShift",children:col},options);col=buildCommon.makeSpan(["col-align-"+(colDescr.align||"c")],[col]);cols.push(col);if(c<nc-1||group.hskipBeforeAndAfter){sepwidth=utils.deflt(colDescr.postgap,arraycolsep);if(sepwidth!==0){colSep=buildCommon.makeSpan(["arraycolsep"],[]);colSep.style.width=sepwidth+"em";cols.push(colSep);}}}body=buildCommon.makeSpan(["mtable"],cols);// Add \hline(s), if any.
if(hlines.length>0){const line=buildCommon.makeLineSpan("hline",options,0.05);const dashes=buildCommon.makeLineSpan("hdashline",options,0.05);const vListElems=[{type:"elem",elem:body,shift:0}];while(hlines.length>0){const hline=hlines.pop();const lineShift=hline.pos-offset;if(hline.isDashed){vListElems.push({type:"elem",elem:dashes,shift:lineShift});}else{vListElems.push({type:"elem",elem:line,shift:lineShift});}}body=buildCommon.makeVList({positionType:"individualShift",children:vListElems},options);}return buildCommon.makeSpan(["mord"],[body],options);};const mathmlBuilder$3=function mathmlBuilder(group,options){return new mathMLTree.MathNode("mtable",group.body.map(function(row){return new mathMLTree.MathNode("mtr",row.map(function(cell){return new mathMLTree.MathNode("mtd",[buildGroup$1(cell,options)]);}));}));};// Convenience function for aligned and alignedat environments.
const alignedHandler=function alignedHandler(context,args){const cols=[];const res=parseArray(context.parser,{cols,addJot:true},"display");// Determining number of columns.
// 1. If the first argument is given, we use it as a number of columns,
//    and makes sure that each row doesn't exceed that number.
// 2. Otherwise, just count number of columns = maximum number
//    of cells in each row ("aligned" mode -- isAligned will be true).
//
// At the same time, prepend empty group {} at beginning of every second
// cell in each row (starting with second cell) so that operators become
// binary.  This behavior is implemented in amsmath's \start@aligned.
let numMaths;let numCols=0;const emptyGroup={type:"ordgroup",mode:context.mode,body:[]};const ordgroup=checkNodeType(args[0],"ordgroup");if(ordgroup){let arg0="";for(let i=0;i<ordgroup.body.length;i++){const textord=assertNodeType(ordgroup.body[i],"textord");arg0+=textord.text;}numMaths=Number(arg0);numCols=numMaths*2;}const isAligned=!numCols;res.body.forEach(function(row){for(let i=1;i<row.length;i+=2){// Modify ordgroup node within styling node
const styling=assertNodeType(row[i],"styling");const ordgroup=assertNodeType(styling.body[0],"ordgroup");ordgroup.body.unshift(emptyGroup);}if(!isAligned){// Case 1
const curMaths=row.length/2;if(numMaths<curMaths){throw new ParseError("Too many math in a row: "+`expected ${numMaths}, but got ${curMaths}`,row[0]);}}else if(numCols<row.length){// Case 2
numCols=row.length;}});// Adjusting alignment.
// In aligned mode, we add one \qquad between columns;
// otherwise we add nothing.
for(let i=0;i<numCols;++i){let align="r";let pregap=0;if(i%2===1){align="l";}else if(i>0&&isAligned){// "aligned" mode.
pregap=1;// add one \quad
}cols[i]={type:"align",align:align,pregap:pregap,postgap:0};}return res;};// Arrays are part of LaTeX, defined in lttab.dtx so its documentation
// is part of the source2e.pdf file of LaTeX2e source documentation.
// {darray} is an {array} environment where cells are set in \displaystyle,
// as defined in nccmath.sty.
defineEnvironment({type:"array",names:["array","darray"],props:{numArgs:1},handler(context,args){// Since no types are specified above, the two possibilities are
// - The argument is wrapped in {} or [], in which case Parser's
//   parseGroup() returns an "ordgroup" wrapping some symbol node.
// - The argument is a bare symbol node.
const symNode=checkSymbolNodeType(args[0]);const colalign=symNode?[args[0]]:assertNodeType(args[0],"ordgroup").body;const cols=colalign.map(function(nde){const node=assertSymbolNodeType(nde);const ca=node.text;if("lcr".indexOf(ca)!==-1){return {type:"align",align:ca};}else if(ca==="|"){return {type:"separator",separator:"|"};}else if(ca===":"){return {type:"separator",separator:":"};}throw new ParseError("Unknown column alignment: "+ca,nde);});const res={cols,hskipBeforeAndAfter:true// \@preamble in lttab.dtx
};return parseArray(context.parser,res,dCellStyle(context.envName));},htmlBuilder:htmlBuilder$3,mathmlBuilder:mathmlBuilder$3});// The matrix environments of amsmath builds on the array environment
// of LaTeX, which is discussed above.
defineEnvironment({type:"array",names:["matrix","pmatrix","bmatrix","Bmatrix","vmatrix","Vmatrix"],props:{numArgs:0},handler(context){const delimiters={"matrix":null,"pmatrix":["(",")"],"bmatrix":["[","]"],"Bmatrix":["\\{","\\}"],"vmatrix":["|","|"],"Vmatrix":["\\Vert","\\Vert"]}[context.envName];// \hskip -\arraycolsep in amsmath
const payload={hskipBeforeAndAfter:false};const res=parseArray(context.parser,payload,dCellStyle(context.envName));return delimiters?{type:"leftright",mode:context.mode,body:[res],left:delimiters[0],right:delimiters[1]}:res;},htmlBuilder:htmlBuilder$3,mathmlBuilder:mathmlBuilder$3});// A cases environment (in amsmath.sty) is almost equivalent to
// \def\arraystretch{1.2}%
// \left\{\begin{array}{@{}l@{\quad}l@{}} … \end{array}\right.
// {dcases} is a {cases} environment where cells are set in \displaystyle,
// as defined in mathtools.sty.
defineEnvironment({type:"array",names:["cases","dcases"],props:{numArgs:0},handler(context){const payload={arraystretch:1.2,cols:[{type:"align",align:"l",pregap:0,// TODO(kevinb) get the current style.
// For now we use the metrics for TEXT style which is what we were
// doing before.  Before attempting to get the current style we
// should look at TeX's behavior especially for \over and matrices.
postgap:1.0/* 1em quad */},{type:"align",align:"l",pregap:0,postgap:0}]};const res=parseArray(context.parser,payload,dCellStyle(context.envName));return {type:"leftright",mode:context.mode,body:[res],left:"\\{",right:"."};},htmlBuilder:htmlBuilder$3,mathmlBuilder:mathmlBuilder$3});// An aligned environment is like the align* environment
// except it operates within math mode.
// Note that we assume \nomallineskiplimit to be zero,
// so that \strut@ is the same as \strut.
defineEnvironment({type:"array",names:["aligned"],props:{numArgs:0},handler:alignedHandler,htmlBuilder:htmlBuilder$3,mathmlBuilder:mathmlBuilder$3});// A gathered environment is like an array environment with one centered
// column, but where rows are considered lines so get \jot line spacing
// and contents are set in \displaystyle.
defineEnvironment({type:"array",names:["gathered"],props:{numArgs:0},handler(context){const res={cols:[{type:"align",align:"c"}],addJot:true};return parseArray(context.parser,res,"display");},htmlBuilder:htmlBuilder$3,mathmlBuilder:mathmlBuilder$3});// alignat environment is like an align environment, but one must explicitly
// specify maximum number of columns in each row, and can adjust spacing between
// each columns.
defineEnvironment({type:"array",names:["alignedat"],// One for numbered and for unnumbered;
// but, KaTeX doesn't supports math numbering yet,
// they make no difference for now.
props:{numArgs:1},handler:alignedHandler,htmlBuilder:htmlBuilder$3,mathmlBuilder:mathmlBuilder$3});// Catch \hline outside array environment
defineFunction({type:"text",// Doesn't matter what this is.
names:["\\hline","\\hdashline"],props:{numArgs:0,allowedInText:true,allowedInMath:true},handler(context,args){throw new ParseError(`${context.funcName} valid only within array environment`);}});const environments=_environments;// defineEnvironment definitions.
// $FlowFixMe, "environment" handler returns an environment ParseNode
defineFunction({type:"environment",names:["\\begin","\\end"],props:{numArgs:1,argTypes:["text"]},handler(_ref,args){let parser=_ref.parser,funcName=_ref.funcName;const nameGroup=args[0];if(nameGroup.type!=="ordgroup"){throw new ParseError("Invalid environment name",nameGroup);}let envName="";for(let i=0;i<nameGroup.body.length;++i){envName+=assertNodeType(nameGroup.body[i],"textord").text;}if(funcName==="\\begin"){// begin...end is similar to left...right
if(!environments.hasOwnProperty(envName)){throw new ParseError("No such environment: "+envName,nameGroup);}// Build the environment object. Arguments and other information will
// be made available to the begin and end methods using properties.
const env=environments[envName];const _parser$parseArgument=parser.parseArguments("\\begin{"+envName+"}",env),args=_parser$parseArgument.args,optArgs=_parser$parseArgument.optArgs;const context={mode:parser.mode,envName,parser};const result=env.handler(context,args,optArgs);parser.expect("\\end",false);const endNameToken=parser.nextToken;const end=assertNodeType(parser.parseFunction(),"environment");if(end.name!==envName){throw new ParseError(`Mismatch: \\begin{${envName}} matched by \\end{${end.name}}`,endNameToken);}return result;}return {type:"environment",mode:parser.mode,name:envName,nameGroup};}});const makeSpan$2=buildCommon.makeSpan;function htmlBuilder$4(group,options){const elements=buildExpression(group.body,options,true);return makeSpan$2([group.mclass],elements,options);}function mathmlBuilder$4(group,options){const inner=buildExpression$1(group.body,options);return mathMLTree.newDocumentFragment(inner);}// Math class commands except \mathop
defineFunction({type:"mclass",names:["\\mathord","\\mathbin","\\mathrel","\\mathopen","\\mathclose","\\mathpunct","\\mathinner"],props:{numArgs:1},handler(_ref,args){let parser=_ref.parser,funcName=_ref.funcName;const body=args[0];return {type:"mclass",mode:parser.mode,mclass:"m"+funcName.substr(5),body:ordargument(body)};},htmlBuilder:htmlBuilder$4,mathmlBuilder:mathmlBuilder$4});const binrelClass=arg=>{// \binrel@ spacing varies with (bin|rel|ord) of the atom in the argument.
// (by rendering separately and with {}s before and after, and measuring
// the change in spacing).  We'll do roughly the same by detecting the
// atom type directly.
const atom=arg.type==="ordgroup"&&arg.body.length?arg.body[0]:arg;if(atom.type==="atom"&&(atom.family==="bin"||atom.family==="rel")){return "m"+atom.family;}else{return "mord";}};// \@binrel{x}{y} renders like y but as mbin/mrel/mord if x is mbin/mrel/mord.
// This is equivalent to \binrel@{x}\binrel@@{y} in AMSTeX.
defineFunction({type:"mclass",names:["\\@binrel"],props:{numArgs:2},handler(_ref2,args){let parser=_ref2.parser;return {type:"mclass",mode:parser.mode,mclass:binrelClass(args[0]),body:[args[1]]};}});// Build a relation or stacked op by placing one symbol on top of another
defineFunction({type:"mclass",names:["\\stackrel","\\overset","\\underset"],props:{numArgs:2},handler(_ref3,args){let parser=_ref3.parser,funcName=_ref3.funcName;const baseArg=args[1];const shiftedArg=args[0];let mclass;if(funcName!=="\\stackrel"){// LaTeX applies \binrel spacing to \overset and \underset.
mclass=binrelClass(baseArg);}else{mclass="mrel";// for \stackrel
}const baseOp={type:"op",mode:baseArg.mode,limits:true,alwaysHandleSupSub:true,symbol:false,suppressBaseShift:funcName!=="\\stackrel",body:ordargument(baseArg)};const supsub={type:"supsub",mode:shiftedArg.mode,base:baseOp,sup:funcName==="\\underset"?null:shiftedArg,sub:funcName==="\\underset"?shiftedArg:null};return {type:"mclass",mode:parser.mode,mclass,body:[supsub]};},htmlBuilder:htmlBuilder$4,mathmlBuilder:mathmlBuilder$4});// TODO(kevinb): implement \\sl and \\sc
const htmlBuilder$5=(group,options)=>{const font=group.font;const newOptions=options.withFont(font);return buildGroup(group.body,newOptions);};const mathmlBuilder$5=(group,options)=>{const font=group.font;const newOptions=options.withFont(font);return buildGroup$1(group.body,newOptions);};const fontAliases={"\\Bbb":"\\mathbb","\\bold":"\\mathbf","\\frak":"\\mathfrak","\\bm":"\\boldsymbol"};defineFunction({type:"font",names:[// styles, except \boldsymbol defined below
"\\mathrm","\\mathit","\\mathbf","\\mathnormal",// families
"\\mathbb","\\mathcal","\\mathfrak","\\mathscr","\\mathsf","\\mathtt",// aliases, except \bm defined below
"\\Bbb","\\bold","\\frak"],props:{numArgs:1,greediness:2},handler:(_ref,args)=>{let parser=_ref.parser,funcName=_ref.funcName;const body=args[0];let func=funcName;if(func in fontAliases){func=fontAliases[func];}return {type:"font",mode:parser.mode,font:func.slice(1),body};},htmlBuilder:htmlBuilder$5,mathmlBuilder:mathmlBuilder$5});defineFunction({type:"mclass",names:["\\boldsymbol","\\bm"],props:{numArgs:1,greediness:2},handler:(_ref2,args)=>{let parser=_ref2.parser;const body=args[0];// amsbsy.sty's \boldsymbol uses \binrel spacing to inherit the
// argument's bin|rel|ord status
return {type:"mclass",mode:parser.mode,mclass:binrelClass(body),body:[{type:"font",mode:parser.mode,font:"boldsymbol",body}]};}});// Old font changing functions
defineFunction({type:"font",names:["\\rm","\\sf","\\tt","\\bf","\\it"],props:{numArgs:0,allowedInText:true},handler:(_ref3,args)=>{let parser=_ref3.parser,funcName=_ref3.funcName,breakOnTokenText=_ref3.breakOnTokenText;const mode=parser.mode;const body=parser.parseExpression(true,breakOnTokenText);const style=`math${funcName.slice(1)}`;return {type:"font",mode:mode,font:style,body:{type:"ordgroup",mode:parser.mode,body}};},htmlBuilder:htmlBuilder$5,mathmlBuilder:mathmlBuilder$5});const htmlBuilder$6=(group,options)=>{// Fractions are handled in the TeXbook on pages 444-445, rules 15(a-e).
// Figure out what style this fraction should be in based on the
// function used
let style=options.style;if(group.size==="display"){style=Style$1.DISPLAY;}else if(group.size==="text"&&style.size===Style$1.DISPLAY.size){// We're in a \tfrac but incoming style is displaystyle, so:
style=Style$1.TEXT;}else if(group.size==="script"){style=Style$1.SCRIPT;}else if(group.size==="scriptscript"){style=Style$1.SCRIPTSCRIPT;}const nstyle=style.fracNum();const dstyle=style.fracDen();let newOptions;newOptions=options.havingStyle(nstyle);const numerm=buildGroup(group.numer,newOptions,options);if(group.continued){// \cfrac inserts a \strut into the numerator.
// Get \strut dimensions from TeXbook page 353.
const hStrut=8.5/options.fontMetrics().ptPerEm;const dStrut=3.5/options.fontMetrics().ptPerEm;numerm.height=numerm.height<hStrut?hStrut:numerm.height;numerm.depth=numerm.depth<dStrut?dStrut:numerm.depth;}newOptions=options.havingStyle(dstyle);const denomm=buildGroup(group.denom,newOptions,options);let rule;let ruleWidth;let ruleSpacing;if(group.hasBarLine){if(group.barSize){ruleWidth=calculateSize(group.barSize,options);rule=buildCommon.makeLineSpan("frac-line",options,ruleWidth);}else{rule=buildCommon.makeLineSpan("frac-line",options);}ruleWidth=rule.height;ruleSpacing=rule.height;}else{rule=null;ruleWidth=0;ruleSpacing=options.fontMetrics().defaultRuleThickness;}// Rule 15b
let numShift;let clearance;let denomShift;if(style.size===Style$1.DISPLAY.size){numShift=options.fontMetrics().num1;if(ruleWidth>0){clearance=3*ruleSpacing;}else{clearance=7*ruleSpacing;}denomShift=options.fontMetrics().denom1;}else{if(ruleWidth>0){numShift=options.fontMetrics().num2;clearance=ruleSpacing;}else{numShift=options.fontMetrics().num3;clearance=3*ruleSpacing;}denomShift=options.fontMetrics().denom2;}let frac;if(!rule){// Rule 15c
const candidateClearance=numShift-numerm.depth-(denomm.height-denomShift);if(candidateClearance<clearance){numShift+=0.5*(clearance-candidateClearance);denomShift+=0.5*(clearance-candidateClearance);}frac=buildCommon.makeVList({positionType:"individualShift",children:[{type:"elem",elem:denomm,shift:denomShift},{type:"elem",elem:numerm,shift:-numShift}]},options);}else{// Rule 15d
const axisHeight=options.fontMetrics().axisHeight;if(numShift-numerm.depth-(axisHeight+0.5*ruleWidth)<clearance){numShift+=clearance-(numShift-numerm.depth-(axisHeight+0.5*ruleWidth));}if(axisHeight-0.5*ruleWidth-(denomm.height-denomShift)<clearance){denomShift+=clearance-(axisHeight-0.5*ruleWidth-(denomm.height-denomShift));}const midShift=-(axisHeight-0.5*ruleWidth);frac=buildCommon.makeVList({positionType:"individualShift",children:[{type:"elem",elem:denomm,shift:denomShift},{type:"elem",elem:rule,shift:midShift},{type:"elem",elem:numerm,shift:-numShift}]},options);}// Since we manually change the style sometimes (with \dfrac or \tfrac),
// account for the possible size change here.
newOptions=options.havingStyle(style);frac.height*=newOptions.sizeMultiplier/options.sizeMultiplier;frac.depth*=newOptions.sizeMultiplier/options.sizeMultiplier;// Rule 15e
let delimSize;if(style.size===Style$1.DISPLAY.size){delimSize=options.fontMetrics().delim1;}else{delimSize=options.fontMetrics().delim2;}let leftDelim;let rightDelim;if(group.leftDelim==null){leftDelim=makeNullDelimiter(options,["mopen"]);}else{leftDelim=delimiter.customSizedDelim(group.leftDelim,delimSize,true,options.havingStyle(style),group.mode,["mopen"]);}if(group.continued){rightDelim=buildCommon.makeSpan([]);// zero width for \cfrac
}else if(group.rightDelim==null){rightDelim=makeNullDelimiter(options,["mclose"]);}else{rightDelim=delimiter.customSizedDelim(group.rightDelim,delimSize,true,options.havingStyle(style),group.mode,["mclose"]);}return buildCommon.makeSpan(["mord"].concat(newOptions.sizingClasses(options)),[leftDelim,buildCommon.makeSpan(["mfrac"],[frac]),rightDelim],options);};const mathmlBuilder$6=(group,options)=>{const node=new mathMLTree.MathNode("mfrac",[buildGroup$1(group.numer,options),buildGroup$1(group.denom,options)]);if(!group.hasBarLine){node.setAttribute("linethickness","0px");}else if(group.barSize){const ruleWidth=calculateSize(group.barSize,options);node.setAttribute("linethickness",ruleWidth+"em");}if(group.leftDelim!=null||group.rightDelim!=null){const withDelims=[];if(group.leftDelim!=null){const leftOp=new mathMLTree.MathNode("mo",[new mathMLTree.TextNode(group.leftDelim)]);leftOp.setAttribute("fence","true");withDelims.push(leftOp);}withDelims.push(node);if(group.rightDelim!=null){const rightOp=new mathMLTree.MathNode("mo",[new mathMLTree.TextNode(group.rightDelim)]);rightOp.setAttribute("fence","true");withDelims.push(rightOp);}return makeRow(withDelims);}return node;};defineFunction({type:"genfrac",names:["\\cfrac","\\dfrac","\\frac","\\tfrac","\\dbinom","\\binom","\\tbinom","\\\\atopfrac",// can’t be entered directly
"\\\\bracefrac","\\\\brackfrac"],props:{numArgs:2,greediness:2},handler:(_ref,args)=>{let parser=_ref.parser,funcName=_ref.funcName;const numer=args[0];const denom=args[1];let hasBarLine;let leftDelim=null;let rightDelim=null;let size="auto";switch(funcName){case"\\cfrac":case"\\dfrac":case"\\frac":case"\\tfrac":hasBarLine=true;break;case"\\\\atopfrac":hasBarLine=false;break;case"\\dbinom":case"\\binom":case"\\tbinom":hasBarLine=false;leftDelim="(";rightDelim=")";break;case"\\\\bracefrac":hasBarLine=false;leftDelim="\\{";rightDelim="\\}";break;case"\\\\brackfrac":hasBarLine=false;leftDelim="[";rightDelim="]";break;default:throw new Error("Unrecognized genfrac command");}switch(funcName){case"\\cfrac":case"\\dfrac":case"\\dbinom":size="display";break;case"\\tfrac":case"\\tbinom":size="text";break;}return {type:"genfrac",mode:parser.mode,continued:funcName==="\\cfrac",numer,denom,hasBarLine,leftDelim,rightDelim,size,barSize:null};},htmlBuilder:htmlBuilder$6,mathmlBuilder:mathmlBuilder$6});// Infix generalized fractions -- these are not rendered directly, but replaced
// immediately by one of the variants above.
defineFunction({type:"infix",names:["\\over","\\choose","\\atop","\\brace","\\brack"],props:{numArgs:0,infix:true},handler(_ref2){let parser=_ref2.parser,funcName=_ref2.funcName,token=_ref2.token;let replaceWith;switch(funcName){case"\\over":replaceWith="\\frac";break;case"\\choose":replaceWith="\\binom";break;case"\\atop":replaceWith="\\\\atopfrac";break;case"\\brace":replaceWith="\\\\bracefrac";break;case"\\brack":replaceWith="\\\\brackfrac";break;default:throw new Error("Unrecognized infix genfrac command");}return {type:"infix",mode:parser.mode,replaceWith,token};}});const stylArray=["display","text","script","scriptscript"];const delimFromValue=function delimFromValue(delimString){let delim=null;if(delimString.length>0){delim=delimString;delim=delim==="."?null:delim;}return delim;};defineFunction({type:"genfrac",names:["\\genfrac"],props:{numArgs:6,greediness:6,argTypes:["math","math","size","text","math","math"]},handler(_ref3,args){let parser=_ref3.parser;const numer=args[4];const denom=args[5];// Look into the parse nodes to get the desired delimiters.
let leftNode=checkNodeType(args[0],"atom");if(leftNode){leftNode=assertAtomFamily(args[0],"open");}const leftDelim=leftNode?delimFromValue(leftNode.text):null;let rightNode=checkNodeType(args[1],"atom");if(rightNode){rightNode=assertAtomFamily(args[1],"close");}const rightDelim=rightNode?delimFromValue(rightNode.text):null;const barNode=assertNodeType(args[2],"size");let hasBarLine;let barSize=null;if(barNode.isBlank){// \genfrac acts differently than \above.
// \genfrac treats an empty size group as a signal to use a
// standard bar size. \above would see size = 0 and omit the bar.
hasBarLine=true;}else{barSize=barNode.value;hasBarLine=barSize.number>0;}// Find out if we want displaystyle, textstyle, etc.
let size="auto";let styl=checkNodeType(args[3],"ordgroup");if(styl){if(styl.body.length>0){const textOrd=assertNodeType(styl.body[0],"textord");size=stylArray[Number(textOrd.text)];}}else{styl=assertNodeType(args[3],"textord");size=stylArray[Number(styl.text)];}return {type:"genfrac",mode:parser.mode,numer,denom,continued:false,hasBarLine,barSize,leftDelim,rightDelim,size};},htmlBuilder:htmlBuilder$6,mathmlBuilder:mathmlBuilder$6});// \above is an infix fraction that also defines a fraction bar size.
defineFunction({type:"infix",names:["\\above"],props:{numArgs:1,argTypes:["size"],infix:true},handler(_ref4,args){let parser=_ref4.parser,funcName=_ref4.funcName,token=_ref4.token;return {type:"infix",mode:parser.mode,replaceWith:"\\\\abovefrac",size:assertNodeType(args[0],"size").value,token};}});defineFunction({type:"genfrac",names:["\\\\abovefrac"],props:{numArgs:3,argTypes:["math","size","math"]},handler:(_ref5,args)=>{let parser=_ref5.parser,funcName=_ref5.funcName;const numer=args[0];const barSize=assert(assertNodeType(args[1],"infix").size);const denom=args[2];const hasBarLine=barSize.number>0;return {type:"genfrac",mode:parser.mode,numer,denom,continued:false,hasBarLine,barSize,leftDelim:null,rightDelim:null,size:"auto"};},htmlBuilder:htmlBuilder$6,mathmlBuilder:mathmlBuilder$6});// NOTE: Unlike most `htmlBuilder`s, this one handles not only "horizBrace", but
const htmlBuilder$7=(grp,options)=>{const style=options.style;// Pull out the `ParseNode<"horizBrace">` if `grp` is a "supsub" node.
let supSubGroup;let group;const supSub=checkNodeType(grp,"supsub");if(supSub){// Ref: LaTeX source2e: }}}}\limits}
// i.e. LaTeX treats the brace similar to an op and passes it
// with \limits, so we need to assign supsub style.
supSubGroup=supSub.sup?buildGroup(supSub.sup,options.havingStyle(style.sup()),options):buildGroup(supSub.sub,options.havingStyle(style.sub()),options);group=assertNodeType(supSub.base,"horizBrace");}else{group=assertNodeType(grp,"horizBrace");}// Build the base group
const body=buildGroup(group.base,options.havingBaseStyle(Style$1.DISPLAY));// Create the stretchy element
const braceBody=stretchy.svgSpan(group,options);// Generate the vlist, with the appropriate kerns        ┏━━━━━━━━┓
// This first vlist contains the content and the brace:   equation
let vlist;if(group.isOver){vlist=buildCommon.makeVList({positionType:"firstBaseline",children:[{type:"elem",elem:body},{type:"kern",size:0.1},{type:"elem",elem:braceBody}]},options);// $FlowFixMe: Replace this with passing "svg-align" into makeVList.
vlist.children[0].children[0].children[1].classes.push("svg-align");}else{vlist=buildCommon.makeVList({positionType:"bottom",positionData:body.depth+0.1+braceBody.height,children:[{type:"elem",elem:braceBody},{type:"kern",size:0.1},{type:"elem",elem:body}]},options);// $FlowFixMe: Replace this with passing "svg-align" into makeVList.
vlist.children[0].children[0].children[0].classes.push("svg-align");}if(supSubGroup){// To write the supsub, wrap the first vlist in another vlist:
// They can't all go in the same vlist, because the note might be
// wider than the equation. We want the equation to control the
// brace width.
//      note          long note           long note
//   ┏━━━━━━━━┓   or    ┏━━━┓     not    ┏━━━━━━━━━┓
//    equation           eqn                 eqn
const vSpan=buildCommon.makeSpan(["mord",group.isOver?"mover":"munder"],[vlist],options);if(group.isOver){vlist=buildCommon.makeVList({positionType:"firstBaseline",children:[{type:"elem",elem:vSpan},{type:"kern",size:0.2},{type:"elem",elem:supSubGroup}]},options);}else{vlist=buildCommon.makeVList({positionType:"bottom",positionData:vSpan.depth+0.2+supSubGroup.height+supSubGroup.depth,children:[{type:"elem",elem:supSubGroup},{type:"kern",size:0.2},{type:"elem",elem:vSpan}]},options);}}return buildCommon.makeSpan(["mord",group.isOver?"mover":"munder"],[vlist],options);};const mathmlBuilder$7=(group,options)=>{const accentNode=stretchy.mathMLnode(group.label);return new mathMLTree.MathNode(group.isOver?"mover":"munder",[buildGroup$1(group.base,options),accentNode]);};// Horizontal stretchy braces
defineFunction({type:"horizBrace",names:["\\overbrace","\\underbrace"],props:{numArgs:1},handler(_ref,args){let parser=_ref.parser,funcName=_ref.funcName;return {type:"horizBrace",mode:parser.mode,label:funcName,isOver:/^\\over/.test(funcName),base:args[0]};},htmlBuilder:htmlBuilder$7,mathmlBuilder:mathmlBuilder$7});defineFunction({type:"href",names:["\\href"],props:{numArgs:2,argTypes:["url","original"],allowedInText:true},handler:(_ref,args)=>{let parser=_ref.parser;const body=args[1];const href=assertNodeType(args[0],"url").url;return {type:"href",mode:parser.mode,href,body:ordargument(body)};},htmlBuilder:(group,options)=>{const elements=buildExpression(group.body,options,false);return buildCommon.makeAnchor(group.href,[],elements,options);},mathmlBuilder:(group,options)=>{let math=buildExpressionRow(group.body,options);if(!(math instanceof MathNode)){math=new MathNode("mrow",[math]);}math.setAttribute("href",group.href);return math;}});defineFunction({type:"href",names:["\\url"],props:{numArgs:1,argTypes:["url"],allowedInText:true},handler:(_ref2,args)=>{let parser=_ref2.parser;const href=assertNodeType(args[0],"url").url;const chars=[];for(let i=0;i<href.length;i++){let c=href[i];if(c==="~"){c="\\textasciitilde";}chars.push({type:"textord",mode:"text",text:c});}const body={type:"text",mode:parser.mode,font:"\\texttt",body:chars};return {type:"href",mode:parser.mode,href,body:ordargument(body)};}});defineFunction({type:"htmlmathml",names:["\\html@mathml"],props:{numArgs:2,allowedInText:true},handler:(_ref,args)=>{let parser=_ref.parser;return {type:"htmlmathml",mode:parser.mode,html:ordargument(args[0]),mathml:ordargument(args[1])};},htmlBuilder:(group,options)=>{const elements=buildExpression(group.html,options,false);return buildCommon.makeFragment(elements);},mathmlBuilder:(group,options)=>{return buildExpressionRow(group.mathml,options);}});// Horizontal spacing commands
defineFunction({type:"kern",names:["\\kern","\\mkern","\\hskip","\\mskip"],props:{numArgs:1,argTypes:["size"],allowedInText:true},handler(_ref,args){let parser=_ref.parser,funcName=_ref.funcName;const size=assertNodeType(args[0],"size");if(parser.settings.strict){const mathFunction=funcName[1]==='m';// \mkern, \mskip
const muUnit=size.value.unit==='mu';if(mathFunction){if(!muUnit){parser.settings.reportNonstrict("mathVsTextUnits",`LaTeX's ${funcName} supports only mu units, `+`not ${size.value.unit} units`);}if(parser.mode!=="math"){parser.settings.reportNonstrict("mathVsTextUnits",`LaTeX's ${funcName} works only in math mode`);}}else{// !mathFunction
if(muUnit){parser.settings.reportNonstrict("mathVsTextUnits",`LaTeX's ${funcName} doesn't support mu units`);}}}return {type:"kern",mode:parser.mode,dimension:size.value};},htmlBuilder(group,options){return buildCommon.makeGlue(group.dimension,options);},mathmlBuilder(group,options){const dimension=calculateSize(group.dimension,options);return new mathMLTree.SpaceNode(dimension);}});// Horizontal overlap functions
defineFunction({type:"lap",names:["\\mathllap","\\mathrlap","\\mathclap"],props:{numArgs:1,allowedInText:true},handler:(_ref,args)=>{let parser=_ref.parser,funcName=_ref.funcName;const body=args[0];return {type:"lap",mode:parser.mode,alignment:funcName.slice(5),body};},htmlBuilder:(group,options)=>{// mathllap, mathrlap, mathclap
let inner;if(group.alignment==="clap"){// ref: https://www.math.lsu.edu/~aperlis/publications/mathclap/
inner=buildCommon.makeSpan([],[buildGroup(group.body,options)]);// wrap, since CSS will center a .clap > .inner > span
inner=buildCommon.makeSpan(["inner"],[inner],options);}else{inner=buildCommon.makeSpan(["inner"],[buildGroup(group.body,options)]);}const fix=buildCommon.makeSpan(["fix"],[]);let node=buildCommon.makeSpan([group.alignment],[inner,fix],options);// At this point, we have correctly set horizontal alignment of the
// two items involved in the lap.
// Next, use a strut to set the height of the HTML bounding box.
// Otherwise, a tall argument may be misplaced.
const strut=buildCommon.makeSpan(["strut"]);strut.style.height=node.height+node.depth+"em";strut.style.verticalAlign=-node.depth+"em";node.children.unshift(strut);// Next, prevent vertical misplacement when next to something tall.
node=buildCommon.makeVList({positionType:"firstBaseline",children:[{type:"elem",elem:node}]},options);// Get the horizontal spacing correct relative to adjacent items.
return buildCommon.makeSpan(["mord"],[node],options);},mathmlBuilder:(group,options)=>{// mathllap, mathrlap, mathclap
const node=new mathMLTree.MathNode("mpadded",[buildGroup$1(group.body,options)]);if(group.alignment!=="rlap"){const offset=group.alignment==="llap"?"-1":"-0.5";node.setAttribute("lspace",offset+"width");}node.setAttribute("width","0px");return node;}});defineFunction({type:"styling",names:["\\(","$"],props:{numArgs:0,allowedInText:true,allowedInMath:false,consumeMode:"math"},handler(_ref,args){let funcName=_ref.funcName,parser=_ref.parser;const outerMode=parser.mode;parser.switchMode("math");const close=funcName==="\\("?"\\)":"$";const body=parser.parseExpression(false,close);// We can't expand the next symbol after the closing $ until after
// switching modes back.  So don't consume within expect.
parser.expect(close,false);parser.switchMode(outerMode);parser.consume();return {type:"styling",mode:parser.mode,style:"text",body};}});// Check for extra closing math delimiters
defineFunction({type:"text",// Doesn't matter what this is.
names:["\\)","\\]"],props:{numArgs:0,allowedInText:true,allowedInMath:false},handler(context,args){throw new ParseError(`Mismatched ${context.funcName}`);}});const chooseMathStyle=(group,options)=>{switch(options.style.size){case Style$1.DISPLAY.size:return group.display;case Style$1.TEXT.size:return group.text;case Style$1.SCRIPT.size:return group.script;case Style$1.SCRIPTSCRIPT.size:return group.scriptscript;default:return group.text;}};defineFunction({type:"mathchoice",names:["\\mathchoice"],props:{numArgs:4},handler:(_ref,args)=>{let parser=_ref.parser;return {type:"mathchoice",mode:parser.mode,display:ordargument(args[0]),text:ordargument(args[1]),script:ordargument(args[2]),scriptscript:ordargument(args[3])};},htmlBuilder:(group,options)=>{const body=chooseMathStyle(group,options);const elements=buildExpression(body,options,false);return buildCommon.makeFragment(elements);},mathmlBuilder:(group,options)=>{const body=chooseMathStyle(group,options);return buildExpressionRow(body,options);}});// Limits, symbols
// NOTE: Unlike most `htmlBuilder`s, this one handles not only "op", but also
const htmlBuilder$8=(grp,options)=>{// Operators are handled in the TeXbook pg. 443-444, rule 13(a).
let supGroup;let subGroup;let hasLimits=false;let group;const supSub=checkNodeType(grp,"supsub");if(supSub){// If we have limits, supsub will pass us its group to handle. Pull
// out the superscript and subscript and set the group to the op in
// its base.
supGroup=supSub.sup;subGroup=supSub.sub;group=assertNodeType(supSub.base,"op");hasLimits=true;}else{group=assertNodeType(grp,"op");}const style=options.style;// Most operators have a large successor symbol, but these don't.
const noSuccessor=["\\smallint"];let large=false;if(style.size===Style$1.DISPLAY.size&&group.symbol&&!utils.contains(noSuccessor,group.name)){// Most symbol operators get larger in displaystyle (rule 13)
large=true;}let base;if(group.symbol){// If this is a symbol, create the symbol.
const fontName=large?"Size2-Regular":"Size1-Regular";let stash="";if(group.name==="\\oiint"||group.name==="\\oiiint"){// No font glyphs yet, so use a glyph w/o the oval.
// TODO: When font glyphs are available, delete this code.
stash=group.name.substr(1);// $FlowFixMe
group.name=stash==="oiint"?"\\iint":"\\iiint";}base=buildCommon.makeSymbol(group.name,fontName,"math",options,["mop","op-symbol",large?"large-op":"small-op"]);if(stash.length>0){// We're in \oiint or \oiiint. Overlay the oval.
// TODO: When font glyphs are available, delete this code.
const italic=base.italic;const oval=buildCommon.staticSvg(stash+"Size"+(large?"2":"1"),options);base=buildCommon.makeVList({positionType:"individualShift",children:[{type:"elem",elem:base,shift:0},{type:"elem",elem:oval,shift:large?0.08:0}]},options);// $FlowFixMe
group.name="\\"+stash;base.classes.unshift("mop");// $FlowFixMe
base.italic=italic;}}else if(group.body){// If this is a list, compose that list.
const inner=buildExpression(group.body,options,true);if(inner.length===1&&inner[0]instanceof SymbolNode){base=inner[0];base.classes[0]="mop";// replace old mclass
}else{base=buildCommon.makeSpan(["mop"],buildCommon.tryCombineChars(inner),options);}}else{// Otherwise, this is a text operator. Build the text from the
// operator's name.
// TODO(emily): Add a space in the middle of some of these
// operators, like \limsup
const output=[];for(let i=1;i<group.name.length;i++){output.push(buildCommon.mathsym(group.name[i],group.mode));}base=buildCommon.makeSpan(["mop"],output,options);}// If content of op is a single symbol, shift it vertically.
let baseShift=0;let slant=0;if((base instanceof SymbolNode||group.name==="\\oiint"||group.name==="\\oiiint")&&!group.suppressBaseShift){// We suppress the shift of the base of \overset and \underset. Otherwise,
// shift the symbol so its center lies on the axis (rule 13). It
// appears that our fonts have the centers of the symbols already
// almost on the axis, so these numbers are very small. Note we
// don't actually apply this here, but instead it is used either in
// the vlist creation or separately when there are no limits.
baseShift=(base.height-base.depth)/2-options.fontMetrics().axisHeight;// The slant of the symbol is just its italic correction.
// $FlowFixMe
slant=base.italic;}if(hasLimits){// IE 8 clips \int if it is in a display: inline-block. We wrap it
// in a new span so it is an inline, and works.
base=buildCommon.makeSpan([],[base]);let sub;let sup;// We manually have to handle the superscripts and subscripts. This,
// aside from the kern calculations, is copied from supsub.
if(supGroup){const elem=buildGroup(supGroup,options.havingStyle(style.sup()),options);sup={elem,kern:Math.max(options.fontMetrics().bigOpSpacing1,options.fontMetrics().bigOpSpacing3-elem.depth)};}if(subGroup){const elem=buildGroup(subGroup,options.havingStyle(style.sub()),options);sub={elem,kern:Math.max(options.fontMetrics().bigOpSpacing2,options.fontMetrics().bigOpSpacing4-elem.height)};}// Build the final group as a vlist of the possible subscript, base,
// and possible superscript.
let finalGroup;if(sup&&sub){const bottom=options.fontMetrics().bigOpSpacing5+sub.elem.height+sub.elem.depth+sub.kern+base.depth+baseShift;finalGroup=buildCommon.makeVList({positionType:"bottom",positionData:bottom,children:[{type:"kern",size:options.fontMetrics().bigOpSpacing5},{type:"elem",elem:sub.elem,marginLeft:-slant+"em"},{type:"kern",size:sub.kern},{type:"elem",elem:base},{type:"kern",size:sup.kern},{type:"elem",elem:sup.elem,marginLeft:slant+"em"},{type:"kern",size:options.fontMetrics().bigOpSpacing5}]},options);}else if(sub){const top=base.height-baseShift;// Shift the limits by the slant of the symbol. Note
// that we are supposed to shift the limits by 1/2 of the slant,
// but since we are centering the limits adding a full slant of
// margin will shift by 1/2 that.
finalGroup=buildCommon.makeVList({positionType:"top",positionData:top,children:[{type:"kern",size:options.fontMetrics().bigOpSpacing5},{type:"elem",elem:sub.elem,marginLeft:-slant+"em"},{type:"kern",size:sub.kern},{type:"elem",elem:base}]},options);}else if(sup){const bottom=base.depth+baseShift;finalGroup=buildCommon.makeVList({positionType:"bottom",positionData:bottom,children:[{type:"elem",elem:base},{type:"kern",size:sup.kern},{type:"elem",elem:sup.elem,marginLeft:slant+"em"},{type:"kern",size:options.fontMetrics().bigOpSpacing5}]},options);}else{// This case probably shouldn't occur (this would mean the
// supsub was sending us a group with no superscript or
// subscript) but be safe.
return base;}return buildCommon.makeSpan(["mop","op-limits"],[finalGroup],options);}else{if(baseShift){base.style.position="relative";base.style.top=baseShift+"em";}return base;}};const mathmlBuilder$8=(group,options)=>{let node;// TODO(emily): handle big operators using the `largeop` attribute
if(group.symbol){// This is a symbol. Just add the symbol.
node=new MathNode("mo",[makeText(group.name,group.mode)]);}else if(group.body){// This is an operator with children. Add them.
node=new MathNode("mo",buildExpression$1(group.body,options));}else{// This is a text operator. Add all of the characters from the
// operator's name.
// TODO(emily): Add a space in the middle of some of these
// operators, like \limsup.
node=new MathNode("mi",[new TextNode(group.name.slice(1))]);// Append an <mo>&ApplyFunction;</mo>.
// ref: https://www.w3.org/TR/REC-MathML/chap3_2.html#sec3.2.4
const operator=new MathNode("mo",[makeText("\u2061","text")]);return newDocumentFragment([node,operator]);}return node;};const singleCharBigOps={"\u220F":"\\prod","\u2210":"\\coprod","\u2211":"\\sum","\u22c0":"\\bigwedge","\u22c1":"\\bigvee","\u22c2":"\\bigcap","\u22c3":"\\bigcup","\u2a00":"\\bigodot","\u2a01":"\\bigoplus","\u2a02":"\\bigotimes","\u2a04":"\\biguplus","\u2a06":"\\bigsqcup"};defineFunction({type:"op",names:["\\coprod","\\bigvee","\\bigwedge","\\biguplus","\\bigcap","\\bigcup","\\intop","\\prod","\\sum","\\bigotimes","\\bigoplus","\\bigodot","\\bigsqcup","\\smallint","\u220F","\u2210","\u2211","\u22c0","\u22c1","\u22c2","\u22c3","\u2a00","\u2a01","\u2a02","\u2a04","\u2a06"],props:{numArgs:0},handler:(_ref,args)=>{let parser=_ref.parser,funcName=_ref.funcName;let fName=funcName;if(fName.length===1){fName=singleCharBigOps[fName];}return {type:"op",mode:parser.mode,limits:true,symbol:true,name:fName};},htmlBuilder:htmlBuilder$8,mathmlBuilder:mathmlBuilder$8});// Note: calling defineFunction with a type that's already been defined only
// works because the same htmlBuilder and mathmlBuilder are being used.
defineFunction({type:"op",names:["\\mathop"],props:{numArgs:1},handler:(_ref2,args)=>{let parser=_ref2.parser;const body=args[0];return {type:"op",mode:parser.mode,limits:false,symbol:false,body:ordargument(body)};},htmlBuilder:htmlBuilder$8,mathmlBuilder:mathmlBuilder$8});// There are 2 flags for operators; whether they produce limits in
// displaystyle, and whether they are symbols and should grow in
// displaystyle. These four groups cover the four possible choices.
const singleCharIntegrals={"\u222b":"\\int","\u222c":"\\iint","\u222d":"\\iiint","\u222e":"\\oint","\u222f":"\\oiint","\u2230":"\\oiiint"};// No limits, not symbols
defineFunction({type:"op",names:["\\arcsin","\\arccos","\\arctan","\\arctg","\\arcctg","\\arg","\\ch","\\cos","\\cosec","\\cosh","\\cot","\\cotg","\\coth","\\csc","\\ctg","\\cth","\\deg","\\dim","\\exp","\\hom","\\ker","\\lg","\\ln","\\log","\\sec","\\sin","\\sinh","\\sh","\\tan","\\tanh","\\tg","\\th"],props:{numArgs:0},handler(_ref3){let parser=_ref3.parser,funcName=_ref3.funcName;return {type:"op",mode:parser.mode,limits:false,symbol:false,name:funcName};},htmlBuilder:htmlBuilder$8,mathmlBuilder:mathmlBuilder$8});// Limits, not symbols
defineFunction({type:"op",names:["\\det","\\gcd","\\inf","\\lim","\\max","\\min","\\Pr","\\sup"],props:{numArgs:0},handler(_ref4){let parser=_ref4.parser,funcName=_ref4.funcName;return {type:"op",mode:parser.mode,limits:true,symbol:false,name:funcName};},htmlBuilder:htmlBuilder$8,mathmlBuilder:mathmlBuilder$8});// No limits, symbols
defineFunction({type:"op",names:["\\int","\\iint","\\iiint","\\oint","\\oiint","\\oiiint","\u222b","\u222c","\u222d","\u222e","\u222f","\u2230"],props:{numArgs:0},handler(_ref5){let parser=_ref5.parser,funcName=_ref5.funcName;let fName=funcName;if(fName.length===1){fName=singleCharIntegrals[fName];}return {type:"op",mode:parser.mode,limits:false,symbol:true,name:fName};},htmlBuilder:htmlBuilder$8,mathmlBuilder:mathmlBuilder$8});// amsopn.dtx: \mathop{#1\kern\z@\operator@font#3}\newmcodes@
defineFunction({type:"operatorname",names:["\\operatorname"],props:{numArgs:1},handler:(_ref,args)=>{let parser=_ref.parser;const body=args[0];return {type:"operatorname",mode:parser.mode,body:ordargument(body)};},htmlBuilder:(group,options)=>{if(group.body.length>0){const body=group.body.map(child=>{// $FlowFixMe: Check if the node has a string `text` property.
const childText=child.text;if(typeof childText==="string"){return {type:"textord",mode:child.mode,text:childText};}else{return child;}});// Consolidate function names into symbol characters.
const expression=buildExpression(body,options.withFont("mathrm"),true);for(let i=0;i<expression.length;i++){const child=expression[i];if(child instanceof SymbolNode){// Per amsopn package,
// change minus to hyphen and \ast to asterisk
child.text=child.text.replace(/\u2212/,"-").replace(/\u2217/,"*");}}return buildCommon.makeSpan(["mop"],expression,options);}else{return buildCommon.makeSpan(["mop"],[],options);}},mathmlBuilder:(group,options)=>{// The steps taken here are similar to the html version.
let expression=buildExpression$1(group.body,options.withFont("mathrm"));// Is expression a string or has it something like a fraction?
let isAllString=true;// default
for(let i=0;i<expression.length;i++){const node=expression[i];if(node instanceof mathMLTree.SpaceNode);else if(node instanceof mathMLTree.MathNode){switch(node.type){case"mi":case"mn":case"ms":case"mspace":case"mtext":break;// Do nothing yet.
case"mo":{const child=node.children[0];if(node.children.length===1&&child instanceof mathMLTree.TextNode){child.text=child.text.replace(/\u2212/,"-").replace(/\u2217/,"*");}else{isAllString=false;}break;}default:isAllString=false;}}else{isAllString=false;}}if(isAllString){// Write a single TextNode instead of multiple nested tags.
const word=expression.map(node=>node.toText()).join("");expression=[new mathMLTree.TextNode(word)];}const identifier=new mathMLTree.MathNode("mi",expression);identifier.setAttribute("mathvariant","normal");// \u2061 is the same as &ApplyFunction;
// ref: https://www.w3schools.com/charsets/ref_html_entities_a.asp
const operator=new mathMLTree.MathNode("mo",[makeText("\u2061","text")]);return mathMLTree.newDocumentFragment([identifier,operator]);}});defineFunctionBuilders({type:"ordgroup",htmlBuilder(group,options){if(group.semisimple){return buildCommon.makeFragment(buildExpression(group.body,options,false));}return buildCommon.makeSpan(["mord"],buildExpression(group.body,options,true),options);},mathmlBuilder(group,options){return buildExpressionRow(group.body,options);}});defineFunction({type:"overline",names:["\\overline"],props:{numArgs:1},handler(_ref,args){let parser=_ref.parser;const body=args[0];return {type:"overline",mode:parser.mode,body};},htmlBuilder(group,options){// Overlines are handled in the TeXbook pg 443, Rule 9.
// Build the inner group in the cramped style.
const innerGroup=buildGroup(group.body,options.havingCrampedStyle());// Create the line above the body
const line=buildCommon.makeLineSpan("overline-line",options);// Generate the vlist, with the appropriate kerns
const vlist=buildCommon.makeVList({positionType:"firstBaseline",children:[{type:"elem",elem:innerGroup},{type:"kern",size:3*line.height},{type:"elem",elem:line},{type:"kern",size:line.height}]},options);return buildCommon.makeSpan(["mord","overline"],[vlist],options);},mathmlBuilder(group,options){const operator=new mathMLTree.MathNode("mo",[new mathMLTree.TextNode("\u203e")]);operator.setAttribute("stretchy","true");const node=new mathMLTree.MathNode("mover",[buildGroup$1(group.body,options),operator]);node.setAttribute("accent","true");return node;}});defineFunction({type:"phantom",names:["\\phantom"],props:{numArgs:1,allowedInText:true},handler:(_ref,args)=>{let parser=_ref.parser;const body=args[0];return {type:"phantom",mode:parser.mode,body:ordargument(body)};},htmlBuilder:(group,options)=>{const elements=buildExpression(group.body,options.withPhantom(),false);// \phantom isn't supposed to affect the elements it contains.
// See "color" for more details.
return buildCommon.makeFragment(elements);},mathmlBuilder:(group,options)=>{const inner=buildExpression$1(group.body,options);return new mathMLTree.MathNode("mphantom",inner);}});defineFunction({type:"hphantom",names:["\\hphantom"],props:{numArgs:1,allowedInText:true},handler:(_ref2,args)=>{let parser=_ref2.parser;const body=args[0];return {type:"hphantom",mode:parser.mode,body};},htmlBuilder:(group,options)=>{let node=buildCommon.makeSpan([],[buildGroup(group.body,options.withPhantom())]);node.height=0;node.depth=0;if(node.children){for(let i=0;i<node.children.length;i++){node.children[i].height=0;node.children[i].depth=0;}}// See smash for comment re: use of makeVList
node=buildCommon.makeVList({positionType:"firstBaseline",children:[{type:"elem",elem:node}]},options);// For spacing, TeX treats \smash as a math group (same spacing as ord).
return buildCommon.makeSpan(["mord"],[node],options);},mathmlBuilder:(group,options)=>{const inner=buildExpression$1(ordargument(group.body),options);const node=new mathMLTree.MathNode("mphantom",inner);node.setAttribute("height","0px");return node;}});defineFunction({type:"vphantom",names:["\\vphantom"],props:{numArgs:1,allowedInText:true},handler:(_ref3,args)=>{let parser=_ref3.parser;const body=args[0];return {type:"vphantom",mode:parser.mode,body};},htmlBuilder:(group,options)=>{const inner=buildCommon.makeSpan(["inner"],[buildGroup(group.body,options.withPhantom())]);const fix=buildCommon.makeSpan(["fix"],[]);return buildCommon.makeSpan(["mord","rlap"],[inner,fix],options);},mathmlBuilder:(group,options)=>{const inner=buildExpression$1(ordargument(group.body),options);const node=new mathMLTree.MathNode("mphantom",inner);node.setAttribute("width","0px");return node;}});function sizingGroup(value,options,baseOptions){const inner=buildExpression(value,options,false);const multiplier=options.sizeMultiplier/baseOptions.sizeMultiplier;// Add size-resetting classes to the inner list and set maxFontSize
// manually. Handle nested size changes.
for(let i=0;i<inner.length;i++){const pos=inner[i].classes.indexOf("sizing");if(pos<0){Array.prototype.push.apply(inner[i].classes,options.sizingClasses(baseOptions));}else if(inner[i].classes[pos+1]==="reset-size"+options.size){// This is a nested size change: e.g., inner[i] is the "b" in
// `\Huge a \small b`. Override the old size (the `reset-` class)
// but not the new size.
inner[i].classes[pos+1]="reset-size"+baseOptions.size;}inner[i].height*=multiplier;inner[i].depth*=multiplier;}return buildCommon.makeFragment(inner);}const sizeFuncs=["\\tiny","\\sixptsize","\\scriptsize","\\footnotesize","\\small","\\normalsize","\\large","\\Large","\\LARGE","\\huge","\\Huge"];const htmlBuilder$9=(group,options)=>{// Handle sizing operators like \Huge. Real TeX doesn't actually allow
// these functions inside of math expressions, so we do some special
// handling.
const newOptions=options.havingSize(group.size);return sizingGroup(group.body,newOptions,options);};defineFunction({type:"sizing",names:sizeFuncs,props:{numArgs:0,allowedInText:true},handler:(_ref,args)=>{let breakOnTokenText=_ref.breakOnTokenText,funcName=_ref.funcName,parser=_ref.parser;const body=parser.parseExpression(false,breakOnTokenText);return {type:"sizing",mode:parser.mode,// Figure out what size to use based on the list of functions above
size:sizeFuncs.indexOf(funcName)+1,body};},htmlBuilder:htmlBuilder$9,mathmlBuilder:(group,options)=>{const newOptions=options.havingSize(group.size);const inner=buildExpression$1(group.body,newOptions);const node=new mathMLTree.MathNode("mstyle",inner);// TODO(emily): This doesn't produce the correct size for nested size
// changes, because we don't keep state of what style we're currently
// in, so we can't reset the size to normal before changing it.  Now
// that we're passing an options parameter we should be able to fix
// this.
node.setAttribute("mathsize",newOptions.sizeMultiplier+"em");return node;}});defineFunction({type:"raisebox",names:["\\raisebox"],props:{numArgs:2,argTypes:["size","text"],allowedInText:true},handler(_ref,args){let parser=_ref.parser;const amount=assertNodeType(args[0],"size").value;const body=args[1];return {type:"raisebox",mode:parser.mode,dy:amount,body};},htmlBuilder(group,options){const text={type:"text",mode:group.mode,body:ordargument(group.body),font:"mathrm"// simulate \textrm
};const sizedText={type:"sizing",mode:group.mode,body:[text],size:6// simulate \normalsize
};const body=htmlBuilder$9(sizedText,options);const dy=calculateSize(group.dy,options);return buildCommon.makeVList({positionType:"shift",positionData:-dy,children:[{type:"elem",elem:body}]},options);},mathmlBuilder(group,options){const node=new mathMLTree.MathNode("mpadded",[buildGroup$1(group.body,options)]);const dy=group.dy.number+group.dy.unit;node.setAttribute("voffset",dy);return node;}});defineFunction({type:"rule",names:["\\rule"],props:{numArgs:2,numOptionalArgs:1,argTypes:["size","size","size"]},handler(_ref,args,optArgs){let parser=_ref.parser;const shift=optArgs[0];const width=assertNodeType(args[0],"size");const height=assertNodeType(args[1],"size");return {type:"rule",mode:parser.mode,shift:shift&&assertNodeType(shift,"size").value,width:width.value,height:height.value};},htmlBuilder(group,options){// Make an empty span for the rule
const rule=buildCommon.makeSpan(["mord","rule"],[],options);// Calculate the shift, width, and height of the rule, and account for units
let shift=0;if(group.shift){shift=calculateSize(group.shift,options);}const width=calculateSize(group.width,options);const height=calculateSize(group.height,options);// Style the rule to the right size
rule.style.borderRightWidth=width+"em";rule.style.borderTopWidth=height+"em";rule.style.bottom=shift+"em";// Record the height and width
rule.width=width;rule.height=height+shift;rule.depth=-shift;// Font size is the number large enough that the browser will
// reserve at least `absHeight` space above the baseline.
// The 1.125 factor was empirically determined
rule.maxFontSize=height*1.125*options.sizeMultiplier;return rule;},mathmlBuilder(group,options){// TODO(emily): Figure out if there's an actual way to draw black boxes
// in MathML.
const node=new mathMLTree.MathNode("mrow");return node;}});// smash, with optional [tb], as in AMS
defineFunction({type:"smash",names:["\\smash"],props:{numArgs:1,numOptionalArgs:1,allowedInText:true},handler:(_ref,args,optArgs)=>{let parser=_ref.parser;let smashHeight=false;let smashDepth=false;const tbArg=optArgs[0]&&assertNodeType(optArgs[0],"ordgroup");if(tbArg){// Optional [tb] argument is engaged.
// ref: amsmath: \renewcommand{\smash}[1][tb]{%
//               def\mb@t{\ht}\def\mb@b{\dp}\def\mb@tb{\ht\z@\z@\dp}%
let letter="";for(let i=0;i<tbArg.body.length;++i){const node=tbArg.body[i];// $FlowFixMe: Not every node type has a `text` property.
letter=node.text;if(letter==="t"){smashHeight=true;}else if(letter==="b"){smashDepth=true;}else{smashHeight=false;smashDepth=false;break;}}}else{smashHeight=true;smashDepth=true;}const body=args[0];return {type:"smash",mode:parser.mode,body,smashHeight,smashDepth};},htmlBuilder:(group,options)=>{const node=buildCommon.makeSpan([],[buildGroup(group.body,options)]);if(!group.smashHeight&&!group.smashDepth){return node;}if(group.smashHeight){node.height=0;// In order to influence makeVList, we have to reset the children.
if(node.children){for(let i=0;i<node.children.length;i++){node.children[i].height=0;}}}if(group.smashDepth){node.depth=0;if(node.children){for(let i=0;i<node.children.length;i++){node.children[i].depth=0;}}}// At this point, we've reset the TeX-like height and depth values.
// But the span still has an HTML line height.
// makeVList applies "display: table-cell", which prevents the browser
// from acting on that line height. So we'll call makeVList now.
const smashedNode=buildCommon.makeVList({positionType:"firstBaseline",children:[{type:"elem",elem:node}]},options);// For spacing, TeX treats \hphantom as a math group (same spacing as ord).
return buildCommon.makeSpan(["mord"],[smashedNode],options);},mathmlBuilder:(group,options)=>{const node=new mathMLTree.MathNode("mpadded",[buildGroup$1(group.body,options)]);if(group.smashHeight){node.setAttribute("height","0px");}if(group.smashDepth){node.setAttribute("depth","0px");}return node;}});defineFunction({type:"sqrt",names:["\\sqrt"],props:{numArgs:1,numOptionalArgs:1},handler(_ref,args,optArgs){let parser=_ref.parser;const index=optArgs[0];const body=args[0];return {type:"sqrt",mode:parser.mode,body,index};},htmlBuilder(group,options){// Square roots are handled in the TeXbook pg. 443, Rule 11.
// First, we do the same steps as in overline to build the inner group
// and line
let inner=buildGroup(group.body,options.havingCrampedStyle());if(inner.height===0){// Render a small surd.
inner.height=options.fontMetrics().xHeight;}// Some groups can return document fragments.  Handle those by wrapping
// them in a span.
inner=buildCommon.wrapFragment(inner,options);// Calculate the minimum size for the \surd delimiter
const metrics=options.fontMetrics();const theta=metrics.defaultRuleThickness;let phi=theta;if(options.style.id<Style$1.TEXT.id){phi=options.fontMetrics().xHeight;}// Calculate the clearance between the body and line
let lineClearance=theta+phi/4;const minDelimiterHeight=inner.height+inner.depth+lineClearance+theta;// Create a sqrt SVG of the required minimum size
const _delimiter$sqrtImage=delimiter.sqrtImage(minDelimiterHeight,options),img=_delimiter$sqrtImage.span,ruleWidth=_delimiter$sqrtImage.ruleWidth,advanceWidth=_delimiter$sqrtImage.advanceWidth;const delimDepth=img.height-ruleWidth;// Adjust the clearance based on the delimiter size
if(delimDepth>inner.height+inner.depth+lineClearance){lineClearance=(lineClearance+delimDepth-inner.height-inner.depth)/2;}// Shift the sqrt image
const imgShift=img.height-inner.height-lineClearance-ruleWidth;inner.style.paddingLeft=advanceWidth+"em";// Overlay the image and the argument.
const body=buildCommon.makeVList({positionType:"firstBaseline",children:[{type:"elem",elem:inner,wrapperClasses:["svg-align"]},{type:"kern",size:-(inner.height+imgShift)},{type:"elem",elem:img},{type:"kern",size:ruleWidth}]},options);if(!group.index){return buildCommon.makeSpan(["mord","sqrt"],[body],options);}else{// Handle the optional root index
// The index is always in scriptscript style
const newOptions=options.havingStyle(Style$1.SCRIPTSCRIPT);const rootm=buildGroup(group.index,newOptions,options);// The amount the index is shifted by. This is taken from the TeX
// source, in the definition of `\r@@t`.
const toShift=0.6*(body.height-body.depth);// Build a VList with the superscript shifted up correctly
const rootVList=buildCommon.makeVList({positionType:"shift",positionData:-toShift,children:[{type:"elem",elem:rootm}]},options);// Add a class surrounding it so we can add on the appropriate
// kerning
const rootVListWrap=buildCommon.makeSpan(["root"],[rootVList]);return buildCommon.makeSpan(["mord","sqrt"],[rootVListWrap,body],options);}},mathmlBuilder(group,options){const body=group.body,index=group.index;return index?new mathMLTree.MathNode("mroot",[buildGroup$1(body,options),buildGroup$1(index,options)]):new mathMLTree.MathNode("msqrt",[buildGroup$1(body,options)]);}});const styleMap$1={"display":Style$1.DISPLAY,"text":Style$1.TEXT,"script":Style$1.SCRIPT,"scriptscript":Style$1.SCRIPTSCRIPT};defineFunction({type:"styling",names:["\\displaystyle","\\textstyle","\\scriptstyle","\\scriptscriptstyle"],props:{numArgs:0,allowedInText:true},handler(_ref,args){let breakOnTokenText=_ref.breakOnTokenText,funcName=_ref.funcName,parser=_ref.parser;// parse out the implicit body
const body=parser.parseExpression(true,breakOnTokenText);// TODO: Refactor to avoid duplicating styleMap in multiple places (e.g.
// here and in buildHTML and de-dupe the enumeration of all the styles).
// $FlowFixMe: The names above exactly match the styles.
const style=funcName.slice(1,funcName.length-5);return {type:"styling",mode:parser.mode,// Figure out what style to use by pulling out the style from
// the function name
style,body};},htmlBuilder(group,options){// Style changes are handled in the TeXbook on pg. 442, Rule 3.
const newStyle=styleMap$1[group.style];const newOptions=options.havingStyle(newStyle).withFont('');return sizingGroup(group.body,newOptions,options);},mathmlBuilder(group,options){// Figure out what style we're changing to.
// TODO(kevinb): dedupe this with buildHTML.js
// This will be easier of handling of styling nodes is in the same file.
const styleMap={"display":Style$1.DISPLAY,"text":Style$1.TEXT,"script":Style$1.SCRIPT,"scriptscript":Style$1.SCRIPTSCRIPT};const newStyle=styleMap[group.style];const newOptions=options.havingStyle(newStyle);const inner=buildExpression$1(group.body,newOptions);const node=new mathMLTree.MathNode("mstyle",inner);const styleAttributes={"display":["0","true"],"text":["0","false"],"script":["1","false"],"scriptscript":["2","false"]};const attr=styleAttributes[group.style];node.setAttribute("scriptlevel",attr[0]);node.setAttribute("displaystyle",attr[1]);return node;}});/**
 * Sometimes, groups perform special rules when they have superscripts or
 * subscripts attached to them. This function lets the `supsub` group know that
 * Sometimes, groups perform special rules when they have superscripts or
 * its inner element should handle the superscripts and subscripts instead of
 * handling them itself.
 */const htmlBuilderDelegate=function htmlBuilderDelegate(group,options){const base=group.base;if(!base){return null;}else if(base.type==="op"){// Operators handle supsubs differently when they have limits
// (e.g. `\displaystyle\sum_2^3`)
const delegate=base.limits&&(options.style.size===Style$1.DISPLAY.size||base.alwaysHandleSupSub);return delegate?htmlBuilder$8:null;}else if(base.type==="accent"){return utils.isCharacterBox(base.base)?htmlBuilder:null;}else if(base.type==="horizBrace"){const isSup=!group.sub;return isSup===base.isOver?htmlBuilder$7:null;}else{return null;}};// Super scripts and subscripts, whose precise placement can depend on other
// functions that precede them.
defineFunctionBuilders({type:"supsub",htmlBuilder(group,options){// Superscript and subscripts are handled in the TeXbook on page
// 445-446, rules 18(a-f).
// Here is where we defer to the inner group if it should handle
// superscripts and subscripts itself.
const builderDelegate=htmlBuilderDelegate(group,options);if(builderDelegate){return builderDelegate(group,options);}const valueBase=group.base,valueSup=group.sup,valueSub=group.sub;const base=buildGroup(valueBase,options);let supm;let subm;const metrics=options.fontMetrics();// Rule 18a
let supShift=0;let subShift=0;const isCharacterBox=valueBase&&utils.isCharacterBox(valueBase);if(valueSup){const newOptions=options.havingStyle(options.style.sup());supm=buildGroup(valueSup,newOptions,options);if(!isCharacterBox){supShift=base.height-newOptions.fontMetrics().supDrop*newOptions.sizeMultiplier/options.sizeMultiplier;}}if(valueSub){const newOptions=options.havingStyle(options.style.sub());subm=buildGroup(valueSub,newOptions,options);if(!isCharacterBox){subShift=base.depth+newOptions.fontMetrics().subDrop*newOptions.sizeMultiplier/options.sizeMultiplier;}}// Rule 18c
let minSupShift;if(options.style===Style$1.DISPLAY){minSupShift=metrics.sup1;}else if(options.style.cramped){minSupShift=metrics.sup3;}else{minSupShift=metrics.sup2;}// scriptspace is a font-size-independent size, so scale it
// appropriately for use as the marginRight.
const multiplier=options.sizeMultiplier;const marginRight=0.5/metrics.ptPerEm/multiplier+"em";let marginLeft=null;if(subm){// Subscripts shouldn't be shifted by the base's italic correction.
// Account for that by shifting the subscript back the appropriate
// amount. Note we only do this when the base is a single symbol.
const isOiint=group.base&&group.base.type==="op"&&group.base.name&&(group.base.name==="\\oiint"||group.base.name==="\\oiiint");if(base instanceof SymbolNode||isOiint){// $FlowFixMe
marginLeft=-base.italic+"em";}}let supsub;if(supm&&subm){supShift=Math.max(supShift,minSupShift,supm.depth+0.25*metrics.xHeight);subShift=Math.max(subShift,metrics.sub2);const ruleWidth=metrics.defaultRuleThickness;// Rule 18e
const maxWidth=4*ruleWidth;if(supShift-supm.depth-(subm.height-subShift)<maxWidth){subShift=maxWidth-(supShift-supm.depth)+subm.height;const psi=0.8*metrics.xHeight-(supShift-supm.depth);if(psi>0){supShift+=psi;subShift-=psi;}}const vlistElem=[{type:"elem",elem:subm,shift:subShift,marginRight,marginLeft},{type:"elem",elem:supm,shift:-supShift,marginRight}];supsub=buildCommon.makeVList({positionType:"individualShift",children:vlistElem},options);}else if(subm){// Rule 18b
subShift=Math.max(subShift,metrics.sub1,subm.height-0.8*metrics.xHeight);const vlistElem=[{type:"elem",elem:subm,marginLeft,marginRight}];supsub=buildCommon.makeVList({positionType:"shift",positionData:subShift,children:vlistElem},options);}else if(supm){// Rule 18c, d
supShift=Math.max(supShift,minSupShift,supm.depth+0.25*metrics.xHeight);supsub=buildCommon.makeVList({positionType:"shift",positionData:-supShift,children:[{type:"elem",elem:supm,marginRight}]},options);}else{throw new Error("supsub must have either sup or sub.");}// Wrap the supsub vlist in a span.msupsub to reset text-align.
const mclass=getTypeOfDomTree(base,"right")||"mord";return buildCommon.makeSpan([mclass],[base,buildCommon.makeSpan(["msupsub"],[supsub])],options);},mathmlBuilder(group,options){// Is the inner group a relevant horizonal brace?
let isBrace=false;let isOver;let isSup;const horizBrace=checkNodeType(group.base,"horizBrace");if(horizBrace){isSup=!!group.sup;if(isSup===horizBrace.isOver){isBrace=true;isOver=horizBrace.isOver;}}const children=[buildGroup$1(group.base,options)];if(group.sub){children.push(buildGroup$1(group.sub,options));}if(group.sup){children.push(buildGroup$1(group.sup,options));}let nodeType;if(isBrace){nodeType=isOver?"mover":"munder";}else if(!group.sub){const base=group.base;if(base&&base.type==="op"&&base.limits&&options.style===Style$1.DISPLAY){nodeType="mover";}else{nodeType="msup";}}else if(!group.sup){const base=group.base;if(base&&base.type==="op"&&base.limits&&options.style===Style$1.DISPLAY){nodeType="munder";}else{nodeType="msub";}}else{const base=group.base;if(base&&base.type==="op"&&base.limits&&options.style===Style$1.DISPLAY){nodeType="munderover";}else{nodeType="msubsup";}}const node=new mathMLTree.MathNode(nodeType,children);return node;}});defineFunctionBuilders({type:"atom",htmlBuilder(group,options){return buildCommon.mathsym(group.text,group.mode,options,["m"+group.family]);},mathmlBuilder(group,options){const node=new mathMLTree.MathNode("mo",[makeText(group.text,group.mode)]);if(group.family==="bin"){const variant=getVariant(group,options);if(variant==="bold-italic"){node.setAttribute("mathvariant",variant);}}else if(group.family==="punct"){node.setAttribute("separator","true");}return node;}});// "mathord" and "textord" ParseNodes created in Parser.js from symbol Groups in
const defaultVariant={"mi":"italic","mn":"normal","mtext":"normal"};defineFunctionBuilders({type:"mathord",htmlBuilder(group,options){return buildCommon.makeOrd(group,options,"mathord");},mathmlBuilder(group,options){const node=new mathMLTree.MathNode("mi",[makeText(group.text,group.mode,options)]);const variant=getVariant(group,options)||"italic";if(variant!==defaultVariant[node.type]){node.setAttribute("mathvariant",variant);}return node;}});defineFunctionBuilders({type:"textord",htmlBuilder(group,options){return buildCommon.makeOrd(group,options,"textord");},mathmlBuilder(group,options){const text=makeText(group.text,group.mode,options);const variant=getVariant(group,options)||"normal";let node;if(group.mode==='text'){node=new mathMLTree.MathNode("mtext",[text]);}else if(/[0-9]/.test(group.text)){// TODO(kevinb) merge adjacent <mn> nodes
// do it as a post processing step
node=new mathMLTree.MathNode("mn",[text]);}else if(group.text==="\\prime"){node=new mathMLTree.MathNode("mo",[text]);}else{node=new mathMLTree.MathNode("mi",[text]);}if(variant!==defaultVariant[node.type]){node.setAttribute("mathvariant",variant);}return node;}});const cssSpace={"\\nobreak":"nobreak","\\allowbreak":"allowbreak"};// A lookup table to determine whether a spacing function/symbol should be
// treated like a regular space character.  If a symbol or command is a key
// in this table, then it should be a regular space character.  Furthermore,
// the associated value may have a `className` specifying an extra CSS class
// to add to the created `span`.
const regularSpace={" ":{},"\\ ":{},"~":{className:"nobreak"},"\\space":{},"\\nobreakspace":{className:"nobreak"}};// ParseNode<"spacing"> created in Parser.js from the "spacing" symbol Groups in
// src/symbols.js.
defineFunctionBuilders({type:"spacing",htmlBuilder(group,options){if(regularSpace.hasOwnProperty(group.text)){const className=regularSpace[group.text].className||"";// Spaces are generated by adding an actual space. Each of these
// things has an entry in the symbols table, so these will be turned
// into appropriate outputs.
if(group.mode==="text"){const ord=buildCommon.makeOrd(group,options,"textord");ord.classes.push(className);return ord;}else{return buildCommon.makeSpan(["mspace",className],[buildCommon.mathsym(group.text,group.mode,options)],options);}}else if(cssSpace.hasOwnProperty(group.text)){// Spaces based on just a CSS class.
return buildCommon.makeSpan(["mspace",cssSpace[group.text]],[],options);}else{throw new ParseError(`Unknown type of space "${group.text}"`);}},mathmlBuilder(group,options){let node;if(regularSpace.hasOwnProperty(group.text)){node=new mathMLTree.MathNode("mtext",[new mathMLTree.TextNode("\u00a0")]);}else if(cssSpace.hasOwnProperty(group.text)){// CSS-based MathML spaces (\nobreak, \allowbreak) are ignored
return new mathMLTree.MathNode("mspace");}else{throw new ParseError(`Unknown type of space "${group.text}"`);}return node;}});defineFunctionBuilders({type:"tag",mathmlBuilder(group,options){const table=new mathMLTree.MathNode("mtable",[new mathMLTree.MathNode("mlabeledtr",[new mathMLTree.MathNode("mtd",[buildExpressionRow(group.tag,options)]),new mathMLTree.MathNode("mtd",[buildExpressionRow(group.body,options)])])]);table.setAttribute("side","right");return table;}});const textFontFamilies={"\\text":undefined,"\\textrm":"textrm","\\textsf":"textsf","\\texttt":"texttt","\\textnormal":"textrm"};const textFontWeights={"\\textbf":"textbf"};const textFontShapes={"\\textit":"textit"};const optionsWithFont=(group,options)=>{const font=group.font;// Checks if the argument is a font family or a font style.
if(!font){return options;}else if(textFontFamilies[font]){return options.withTextFontFamily(textFontFamilies[font]);}else if(textFontWeights[font]){return options.withTextFontWeight(textFontWeights[font]);}else{return options.withTextFontShape(textFontShapes[font]);}};defineFunction({type:"text",names:[// Font families
"\\text","\\textrm","\\textsf","\\texttt","\\textnormal",// Font weights
"\\textbf",// Font Shapes
"\\textit"],props:{numArgs:1,argTypes:["text"],greediness:2,allowedInText:true,consumeMode:"text"},handler(_ref,args){let parser=_ref.parser,funcName=_ref.funcName;const body=args[0];return {type:"text",mode:parser.mode,body:ordargument(body),font:funcName};},htmlBuilder(group,options){const newOptions=optionsWithFont(group,options);const inner=buildExpression(group.body,newOptions,true);return buildCommon.makeSpan(["mord","text"],buildCommon.tryCombineChars(inner),newOptions);},mathmlBuilder(group,options){const newOptions=optionsWithFont(group,options);return buildExpressionRow(group.body,newOptions);}});defineFunction({type:"underline",names:["\\underline"],props:{numArgs:1,allowedInText:true},handler(_ref,args){let parser=_ref.parser;return {type:"underline",mode:parser.mode,body:args[0]};},htmlBuilder(group,options){// Underlines are handled in the TeXbook pg 443, Rule 10.
// Build the inner group.
const innerGroup=buildGroup(group.body,options);// Create the line to go below the body
const line=buildCommon.makeLineSpan("underline-line",options);// Generate the vlist, with the appropriate kerns
const vlist=buildCommon.makeVList({positionType:"top",positionData:innerGroup.height,children:[{type:"kern",size:line.height},{type:"elem",elem:line},{type:"kern",size:3*line.height},{type:"elem",elem:innerGroup}]},options);return buildCommon.makeSpan(["mord","underline"],[vlist],options);},mathmlBuilder(group,options){const operator=new mathMLTree.MathNode("mo",[new mathMLTree.TextNode("\u203e")]);operator.setAttribute("stretchy","true");const node=new mathMLTree.MathNode("munder",[buildGroup$1(group.body,options),operator]);node.setAttribute("accentunder","true");return node;}});defineFunction({type:"verb",names:["\\verb"],props:{numArgs:0,allowedInText:true},handler(context,args,optArgs){// \verb and \verb* are dealt with directly in Parser.js.
// If we end up here, it's because of a failure to match the two delimiters
// in the regex in Lexer.js.  LaTeX raises the following error when \verb is
// terminated by end of line (or file).
throw new ParseError("\\verb ended by end of line instead of matching delimiter");},htmlBuilder(group,options){const text=makeVerb(group);const body=[];// \verb enters text mode and therefore is sized like \textstyle
const newOptions=options.havingStyle(options.style.text());for(let i=0;i<text.length;i++){let c=text[i];if(c==='~'){c='\\textasciitilde';}body.push(buildCommon.makeSymbol(c,"Typewriter-Regular",group.mode,newOptions,["mord","texttt"]));}return buildCommon.makeSpan(["mord","text"].concat(newOptions.sizingClasses(options)),buildCommon.tryCombineChars(body),newOptions);},mathmlBuilder(group,options){const text=new mathMLTree.TextNode(makeVerb(group));const node=new mathMLTree.MathNode("mtext",[text]);node.setAttribute("mathvariant","monospace");return node;}});/**
 * Converts verb group into body string.
 *
 * \verb* replaces each space with an open box \u2423
 * \verb replaces each space with a no-break space \xA0
 */const makeVerb=group=>group.body.replace(/ /g,group.star?'\u2423':'\xA0');/** Include this to ensure that all functions are defined. */const functions=_functions;/**
 * The Lexer class handles tokenizing the input in various ways. Since our
 * parser expects us to be able to backtrack, the lexer allows lexing from any
 * given starting point.
 *
 * Its main exposed function is the `lex` function, which takes a position to
 * lex from and a type of token to lex. It defers to the appropriate `_innerLex`
 * function.
 *
 * The various `_innerLex` functions perform the actual lexing of different
 * kinds.
 */ /* The following tokenRegex
 * - matches typical whitespace (but not NBSP etc.) using its first group
 * - does not match any control character \x00-\x1f except whitespace
 * - does not match a bare backslash
 * - matches any ASCII character except those just mentioned
 * - does not match the BMP private use area \uE000-\uF8FF
 * - does not match bare surrogate code units
 * - matches any BMP character except for those just described
 * - matches any valid Unicode surrogate pair
 * - matches a backslash followed by one or more letters
 * - matches a backslash followed by any BMP character, including newline
 * Just because the Lexer matches something doesn't mean it's valid input:
 * If there is no matching function or symbol definition, the Parser will
 * still reject the input.
 */const spaceRegexString="[ \r\n\t]";const controlWordRegexString="\\\\[a-zA-Z@]+";const controlSymbolRegexString="\\\\[^\uD800-\uDFFF]";const controlWordWhitespaceRegexString=`${controlWordRegexString}${spaceRegexString}*`;const controlWordWhitespaceRegex=new RegExp(`^(${controlWordRegexString})${spaceRegexString}*$`);const combiningDiacriticalMarkString="[\u0300-\u036f]";const combiningDiacriticalMarksEndRegex=new RegExp(`${combiningDiacriticalMarkString}+$`);const tokenRegexString=`(${spaceRegexString}+)|`+// whitespace
"([!-\\[\\]-\u2027\u202A-\uD7FF\uF900-\uFFFF]"+// single codepoint
`${combiningDiacriticalMarkString}*`+// ...plus accents
"|[\uD800-\uDBFF][\uDC00-\uDFFF]"+// surrogate pair
`${combiningDiacriticalMarkString}*`+// ...plus accents
"|\\\\verb\\*([^]).*?\\3"+// \verb*
"|\\\\verb([^*a-zA-Z]).*?\\4"+// \verb unstarred
`|${controlWordWhitespaceRegexString}`+// \macroName + spaces
`|${controlSymbolRegexString})`;// \\, \', etc.
/** Main Lexer class */class Lexer{// category codes, only supports comment characters (14) for now
constructor(input,settings){this.input=void 0;this.settings=void 0;this.tokenRegex=void 0;this.catcodes=void 0;// Separate accents from characters
this.input=input;this.settings=settings;this.tokenRegex=new RegExp(tokenRegexString,'g');this.catcodes={"%":14// comment character
};}setCatcode(char,code){this.catcodes[char]=code;}/**
   * This function lexes a single token.
   */lex(){const input=this.input;const pos=this.tokenRegex.lastIndex;if(pos===input.length){return new Token("EOF",new SourceLocation(this,pos,pos));}const match=this.tokenRegex.exec(input);if(match===null||match.index!==pos){throw new ParseError(`Unexpected character: '${input[pos]}'`,new Token(input[pos],new SourceLocation(this,pos,pos+1)));}let text=match[2]||" ";if(this.catcodes[text]===14){// comment character
const nlIndex=input.indexOf('\n',this.tokenRegex.lastIndex);if(nlIndex===-1){this.tokenRegex.lastIndex=input.length;// EOF
this.settings.reportNonstrict("commentAtEnd","% comment has no terminating newline; LaTeX would "+"fail because of commenting the end of math mode (e.g. $)");}else{this.tokenRegex.lastIndex=nlIndex+1;}return this.lex();}// Trim any trailing whitespace from control word match
const controlMatch=text.match(controlWordWhitespaceRegex);if(controlMatch){text=controlMatch[1];}return new Token(text,new SourceLocation(this,pos,this.tokenRegex.lastIndex));}}/**
 * A `Namespace` refers to a space of nameable things like macros or lengths,
 * which can be `set` either globally or local to a nested group, using an
 * undo stack similar to how TeX implements this functionality.
 * Performance-wise, `get` and local `set` take constant time, while global
 * `set` takes time proportional to the depth of group nesting.
 */class Namespace{/**
   * Both arguments are optional.  The first argument is an object of
   * built-in mappings which never change.  The second argument is an object
   * of initial (global-level) mappings, which will constantly change
   * according to any global/top-level `set`s done.
   */constructor(builtins,globalMacros){if(builtins===void 0){builtins={};}if(globalMacros===void 0){globalMacros={};}this.current=void 0;this.builtins=void 0;this.undefStack=void 0;this.current=globalMacros;this.builtins=builtins;this.undefStack=[];}/**
   * Start a new nested group, affecting future local `set`s.
   */beginGroup(){this.undefStack.push({});}/**
   * End current nested group, restoring values before the group began.
   */endGroup(){if(this.undefStack.length===0){throw new ParseError("Unbalanced namespace destruction: attempt "+"to pop global namespace; please report this as a bug");}const undefs=this.undefStack.pop();for(const undef in undefs){if(undefs.hasOwnProperty(undef)){if(undefs[undef]===undefined){delete this.current[undef];}else{this.current[undef]=undefs[undef];}}}}/**
   * Detect whether `name` has a definition.  Equivalent to
   * `get(name) != null`.
   */has(name){return this.current.hasOwnProperty(name)||this.builtins.hasOwnProperty(name);}/**
   * Get the current value of a name, or `undefined` if there is no value.
   *
   * Note: Do not use `if (namespace.get(...))` to detect whether a macro
   * is defined, as the definition may be the empty string which evaluates
   * to `false` in JavaScript.  Use `if (namespace.get(...) != null)` or
   * `if (namespace.has(...))`.
   */get(name){if(this.current.hasOwnProperty(name)){return this.current[name];}else{return this.builtins[name];}}/**
   * Set the current value of a name, and optionally set it globally too.
   * Local set() sets the current value and (when appropriate) adds an undo
   * operation to the undo stack.  Global set() may change the undo
   * operation at every level, so takes time linear in their number.
   */set(name,value,global){if(global===void 0){global=false;}if(global){// Global set is equivalent to setting in all groups.  Simulate this
// by destroying any undos currently scheduled for this name,
// and adding an undo with the *new* value (in case it later gets
// locally reset within this environment).
for(let i=0;i<this.undefStack.length;i++){delete this.undefStack[i][name];}if(this.undefStack.length>0){this.undefStack[this.undefStack.length-1][name]=value;}}else{// Undo this set at end of this group (possibly to `undefined`),
// unless an undo is already in place, in which case that older
// value is the correct one.
const top=this.undefStack[this.undefStack.length-1];if(top&&!top.hasOwnProperty(name)){top[name]=this.current[name];}}this.current[name]=value;}}/**
 * Predefined macros for KaTeX.
 * This can be used to define some commands in terms of others.
 */const builtinMacros={};function defineMacro(name,body){builtinMacros[name]=body;}//////////////////////////////////////////////////////////////////////
// macro tools
// LaTeX's \@firstoftwo{#1}{#2} expands to #1, skipping #2
// TeX source: \long\def\@firstoftwo#1#2{#1}
defineMacro("\\@firstoftwo",function(context){const args=context.consumeArgs(2);return {tokens:args[0],numArgs:0};});// LaTeX's \@secondoftwo{#1}{#2} expands to #2, skipping #1
// TeX source: \long\def\@secondoftwo#1#2{#2}
defineMacro("\\@secondoftwo",function(context){const args=context.consumeArgs(2);return {tokens:args[1],numArgs:0};});// LaTeX's \@ifnextchar{#1}{#2}{#3} looks ahead to the next (unexpanded)
// symbol.  If it matches #1, then the macro expands to #2; otherwise, #3.
// Note, however, that it does not consume the next symbol in either case.
defineMacro("\\@ifnextchar",function(context){const args=context.consumeArgs(3);// symbol, if, else
const nextToken=context.future();if(args[0].length===1&&args[0][0].text===nextToken.text){return {tokens:args[1],numArgs:0};}else{return {tokens:args[2],numArgs:0};}});// LaTeX's \@ifstar{#1}{#2} looks ahead to the next (unexpanded) symbol.
// If it is `*`, then it consumes the symbol, and the macro expands to #1;
// otherwise, the macro expands to #2 (without consuming the symbol).
// TeX source: \def\@ifstar#1{\@ifnextchar *{\@firstoftwo{#1}}}
defineMacro("\\@ifstar","\\@ifnextchar *{\\@firstoftwo{#1}}");// LaTeX's \TextOrMath{#1}{#2} expands to #1 in text mode, #2 in math mode
defineMacro("\\TextOrMath",function(context){const args=context.consumeArgs(2);if(context.mode==='text'){return {tokens:args[0],numArgs:0};}else{return {tokens:args[1],numArgs:0};}});// Lookup table for parsing numbers in base 8 through 16
const digitToNumber={"0":0,"1":1,"2":2,"3":3,"4":4,"5":5,"6":6,"7":7,"8":8,"9":9,"a":10,"A":10,"b":11,"B":11,"c":12,"C":12,"d":13,"D":13,"e":14,"E":14,"f":15,"F":15};// TeX \char makes a literal character (catcode 12) using the following forms:
// (see The TeXBook, p. 43)
//   \char123  -- decimal
//   \char'123 -- octal
//   \char"123 -- hex
//   \char`x   -- character that can be written (i.e. isn't active)
//   \char`\x  -- character that cannot be written (e.g. %)
// These all refer to characters from the font, so we turn them into special
// calls to a function \@char dealt with in the Parser.
defineMacro("\\char",function(context){let token=context.popToken();let base;let number='';if(token.text==="'"){base=8;token=context.popToken();}else if(token.text==='"'){base=16;token=context.popToken();}else if(token.text==="`"){token=context.popToken();if(token.text[0]==="\\"){number=token.text.charCodeAt(1);}else if(token.text==="EOF"){throw new ParseError("\\char` missing argument");}else{number=token.text.charCodeAt(0);}}else{base=10;}if(base){// Parse a number in the given base, starting with first `token`.
number=digitToNumber[token.text];if(number==null||number>=base){throw new ParseError(`Invalid base-${base} digit ${token.text}`);}let digit;while((digit=digitToNumber[context.future().text])!=null&&digit<base){number*=base;number+=digit;context.popToken();}}return `\\@char{${number}}`;});// Basic support for macro definitions:
//     \def\macro{expansion}
//     \def\macro#1{expansion}
//     \def\macro#1#2{expansion}
//     \def\macro#1#2#3#4#5#6#7#8#9{expansion}
// Also the \gdef and \global\def equivalents
const def=(context,global)=>{let arg=context.consumeArgs(1)[0];if(arg.length!==1){throw new ParseError("\\gdef's first argument must be a macro name");}const name=arg[0].text;// Count argument specifiers, and check they are in the order #1 #2 ...
let numArgs=0;arg=context.consumeArgs(1)[0];while(arg.length===1&&arg[0].text==="#"){arg=context.consumeArgs(1)[0];if(arg.length!==1){throw new ParseError(`Invalid argument number length "${arg.length}"`);}if(!/^[1-9]$/.test(arg[0].text)){throw new ParseError(`Invalid argument number "${arg[0].text}"`);}numArgs++;if(parseInt(arg[0].text)!==numArgs){throw new ParseError(`Argument number "${arg[0].text}" out of order`);}arg=context.consumeArgs(1)[0];}// Final arg is the expansion of the macro
context.macros.set(name,{tokens:arg,numArgs},global);return '';};defineMacro("\\gdef",context=>def(context,true));defineMacro("\\def",context=>def(context,false));defineMacro("\\global",context=>{const next=context.consumeArgs(1)[0];if(next.length!==1){throw new ParseError("Invalid command after \\global");}const command=next[0].text;// TODO: Should expand command
if(command==="\\def"){// \global\def is equivalent to \gdef
return def(context,true);}else{throw new ParseError(`Invalid command '${command}' after \\global`);}});// \newcommand{\macro}[args]{definition}
// \renewcommand{\macro}[args]{definition}
// TODO: Optional arguments: \newcommand{\macro}[args][default]{definition}
const newcommand=(context,existsOK,nonexistsOK)=>{let arg=context.consumeArgs(1)[0];if(arg.length!==1){throw new ParseError("\\newcommand's first argument must be a macro name");}const name=arg[0].text;const exists=context.isDefined(name);if(exists&&!existsOK){throw new ParseError(`\\newcommand{${name}} attempting to redefine `+`${name}; use \\renewcommand`);}if(!exists&&!nonexistsOK){throw new ParseError(`\\renewcommand{${name}} when command ${name} `+`does not yet exist; use \\newcommand`);}let numArgs=0;arg=context.consumeArgs(1)[0];if(arg.length===1&&arg[0].text==="["){let argText='';let token=context.expandNextToken();while(token.text!=="]"&&token.text!=="EOF"){// TODO: Should properly expand arg, e.g., ignore {}s
argText+=token.text;token=context.expandNextToken();}if(!argText.match(/^\s*[0-9]+\s*$/)){throw new ParseError(`Invalid number of arguments: ${argText}`);}numArgs=parseInt(argText);arg=context.consumeArgs(1)[0];}// Final arg is the expansion of the macro
context.macros.set(name,{tokens:arg,numArgs});return '';};defineMacro("\\newcommand",context=>newcommand(context,false,true));defineMacro("\\renewcommand",context=>newcommand(context,true,false));defineMacro("\\providecommand",context=>newcommand(context,true,true));//////////////////////////////////////////////////////////////////////
// Grouping
// \let\bgroup={ \let\egroup=}
defineMacro("\\bgroup","{");defineMacro("\\egroup","}");// Symbols from latex.ltx:
// \def\lq{`}
// \def\rq{'}
// \def \aa {\r a}
// \def \AA {\r A}
defineMacro("\\lq","`");defineMacro("\\rq","'");defineMacro("\\aa","\\r a");defineMacro("\\AA","\\r A");// Copyright (C) and registered (R) symbols. Use raw symbol in MathML.
// \DeclareTextCommandDefault{\textcopyright}{\textcircled{c}}
// \DeclareTextCommandDefault{\textregistered}{\textcircled{%
//      \check@mathfonts\fontsize\sf@size\z@\math@fontsfalse\selectfont R}}
// \DeclareRobustCommand{\copyright}{%
//    \ifmmode{\nfss@text{\textcopyright}}\else\textcopyright\fi}
defineMacro("\\textcopyright","\\html@mathml{\\textcircled{c}}{\\char`©}");defineMacro("\\copyright","\\TextOrMath{\\textcopyright}{\\text{\\textcopyright}}");defineMacro("\\textregistered","\\html@mathml{\\textcircled{\\scriptsize R}}{\\char`®}");// Characters omitted from Unicode range 1D400–1D7FF
defineMacro("\u212C","\\mathscr{B}");// script
defineMacro("\u2130","\\mathscr{E}");defineMacro("\u2131","\\mathscr{F}");defineMacro("\u210B","\\mathscr{H}");defineMacro("\u2110","\\mathscr{I}");defineMacro("\u2112","\\mathscr{L}");defineMacro("\u2133","\\mathscr{M}");defineMacro("\u211B","\\mathscr{R}");defineMacro("\u212D","\\mathfrak{C}");// Fraktur
defineMacro("\u210C","\\mathfrak{H}");defineMacro("\u2128","\\mathfrak{Z}");// Unicode middle dot
// The KaTeX fonts do not contain U+00B7. Instead, \cdotp displays
// the dot at U+22C5 and gives it punct spacing.
defineMacro("\u00b7","\\cdotp");// \llap and \rlap render their contents in text mode
defineMacro("\\llap","\\mathllap{\\textrm{#1}}");defineMacro("\\rlap","\\mathrlap{\\textrm{#1}}");defineMacro("\\clap","\\mathclap{\\textrm{#1}}");// \not is defined by base/fontmath.ltx via
// \DeclareMathSymbol{\not}{\mathrel}{symbols}{"36}
// It's thus treated like a \mathrel, but defined by a symbol that has zero
// width but extends to the right.  We use \rlap to get that spacing.
defineMacro("\\not",'\\mathrel{\\mathrlap\\@not}');// Negated symbols from base/fontmath.ltx:
// \def\neq{\not=} \let\ne=\neq
// \DeclareRobustCommand
//   \notin{\mathrel{\m@th\mathpalette\c@ncel\in}}
// \def\c@ncel#1#2{\m@th\ooalign{$\hfil#1\mkern1mu/\hfil$\crcr$#1#2$}}
defineMacro("\\neq","\\html@mathml{\\mathrel{\\not=}}{\\mathrel{\\char`≠}}");defineMacro("\\ne","\\neq");defineMacro("\u2260","\\neq");defineMacro("\\notin","\\html@mathml{\\mathrel{{\\in}\\mathllap{/\\mskip1mu}}}"+"{\\mathrel{\\char`∉}}");defineMacro("\u2209","\\notin");// Unicode stacked relations
defineMacro("\u2258","\\html@mathml{"+"\\mathrel{=\\kern{-1em}\\raisebox{0.4em}{$\\scriptsize\\frown$}}"+"}{\\mathrel{\\char`\u2258}}");defineMacro("\u2259","\\html@mathml{\\stackrel{\\tiny\\wedge}{=}}{\\mathrel{\\char`\u2258}}");defineMacro("\u225A","\\html@mathml{\\stackrel{\\tiny\\vee}{=}}{\\mathrel{\\char`\u225A}}");defineMacro("\u225B","\\html@mathml{\\stackrel{\\scriptsize\\star}{=}}"+"{\\mathrel{\\char`\u225B}}");defineMacro("\u225D","\\html@mathml{\\stackrel{\\tiny\\mathrm{def}}{=}}"+"{\\mathrel{\\char`\u225D}}");defineMacro("\u225E","\\html@mathml{\\stackrel{\\tiny\\mathrm{m}}{=}}"+"{\\mathrel{\\char`\u225E}}");defineMacro("\u225F","\\html@mathml{\\stackrel{\\tiny?}{=}}{\\mathrel{\\char`\u225F}}");// Misc Unicode
defineMacro("\u27C2","\\perp");defineMacro("\u203C","\\mathclose{!\\mkern-0.8mu!}");defineMacro("\u220C","\\notni");defineMacro("\u231C","\\ulcorner");defineMacro("\u231D","\\urcorner");defineMacro("\u231E","\\llcorner");defineMacro("\u231F","\\lrcorner");defineMacro("\u00A9","\\copyright");defineMacro("\u00AE","\\textregistered");defineMacro("\uFE0F","\\textregistered");//////////////////////////////////////////////////////////////////////
// LaTeX_2ε
// \vdots{\vbox{\baselineskip4\p@  \lineskiplimit\z@
// \kern6\p@\hbox{.}\hbox{.}\hbox{.}}}
// We'll call \varvdots, which gets a glyph from symbols.js.
// The zero-width rule gets us an equivalent to the vertical 6pt kern.
defineMacro("\\vdots","\\mathord{\\varvdots\\rule{0pt}{15pt}}");defineMacro("\u22ee","\\vdots");//////////////////////////////////////////////////////////////////////
// amsmath.sty
// http://mirrors.concertpass.com/tex-archive/macros/latex/required/amsmath/amsmath.pdf
// Italic Greek capital letters.  AMS defines these with \DeclareMathSymbol,
// but they are equivalent to \mathit{\Letter}.
defineMacro("\\varGamma","\\mathit{\\Gamma}");defineMacro("\\varDelta","\\mathit{\\Delta}");defineMacro("\\varTheta","\\mathit{\\Theta}");defineMacro("\\varLambda","\\mathit{\\Lambda}");defineMacro("\\varXi","\\mathit{\\Xi}");defineMacro("\\varPi","\\mathit{\\Pi}");defineMacro("\\varSigma","\\mathit{\\Sigma}");defineMacro("\\varUpsilon","\\mathit{\\Upsilon}");defineMacro("\\varPhi","\\mathit{\\Phi}");defineMacro("\\varPsi","\\mathit{\\Psi}");defineMacro("\\varOmega","\\mathit{\\Omega}");// \renewcommand{\colon}{\nobreak\mskip2mu\mathpunct{}\nonscript
// \mkern-\thinmuskip{:}\mskip6muplus1mu\relax}
defineMacro("\\colon","\\nobreak\\mskip2mu\\mathpunct{}"+"\\mathchoice{\\mkern-3mu}{\\mkern-3mu}{}{}{:}\\mskip6mu");// \newcommand{\boxed}[1]{\fbox{\m@th$\displaystyle#1$}}
defineMacro("\\boxed","\\fbox{$\\displaystyle{#1}$}");// \def\iff{\DOTSB\;\Longleftrightarrow\;}
// \def\implies{\DOTSB\;\Longrightarrow\;}
// \def\impliedby{\DOTSB\;\Longleftarrow\;}
defineMacro("\\iff","\\DOTSB\\;\\Longleftrightarrow\\;");defineMacro("\\implies","\\DOTSB\\;\\Longrightarrow\\;");defineMacro("\\impliedby","\\DOTSB\\;\\Longleftarrow\\;");// AMSMath's automatic \dots, based on \mdots@@ macro.
const dotsByToken={',':'\\dotsc','\\not':'\\dotsb',// \keybin@ checks for the following:
'+':'\\dotsb','=':'\\dotsb','<':'\\dotsb','>':'\\dotsb','-':'\\dotsb','*':'\\dotsb',':':'\\dotsb',// Symbols whose definition starts with \DOTSB:
'\\DOTSB':'\\dotsb','\\coprod':'\\dotsb','\\bigvee':'\\dotsb','\\bigwedge':'\\dotsb','\\biguplus':'\\dotsb','\\bigcap':'\\dotsb','\\bigcup':'\\dotsb','\\prod':'\\dotsb','\\sum':'\\dotsb','\\bigotimes':'\\dotsb','\\bigoplus':'\\dotsb','\\bigodot':'\\dotsb','\\bigsqcup':'\\dotsb','\\And':'\\dotsb','\\longrightarrow':'\\dotsb','\\Longrightarrow':'\\dotsb','\\longleftarrow':'\\dotsb','\\Longleftarrow':'\\dotsb','\\longleftrightarrow':'\\dotsb','\\Longleftrightarrow':'\\dotsb','\\mapsto':'\\dotsb','\\longmapsto':'\\dotsb','\\hookrightarrow':'\\dotsb','\\doteq':'\\dotsb',// Symbols whose definition starts with \mathbin:
'\\mathbin':'\\dotsb',// Symbols whose definition starts with \mathrel:
'\\mathrel':'\\dotsb','\\relbar':'\\dotsb','\\Relbar':'\\dotsb','\\xrightarrow':'\\dotsb','\\xleftarrow':'\\dotsb',// Symbols whose definition starts with \DOTSI:
'\\DOTSI':'\\dotsi','\\int':'\\dotsi','\\oint':'\\dotsi','\\iint':'\\dotsi','\\iiint':'\\dotsi','\\iiiint':'\\dotsi','\\idotsint':'\\dotsi',// Symbols whose definition starts with \DOTSX:
'\\DOTSX':'\\dotsx'};defineMacro("\\dots",function(context){// TODO: If used in text mode, should expand to \textellipsis.
// However, in KaTeX, \textellipsis and \ldots behave the same
// (in text mode), and it's unlikely we'd see any of the math commands
// that affect the behavior of \dots when in text mode.  So fine for now
// (until we support \ifmmode ... \else ... \fi).
let thedots='\\dotso';const next=context.expandAfterFuture().text;if(next in dotsByToken){thedots=dotsByToken[next];}else if(next.substr(0,4)==='\\not'){thedots='\\dotsb';}else if(next in symbols.math){if(utils.contains(['bin','rel'],symbols.math[next].group)){thedots='\\dotsb';}}return thedots;});const spaceAfterDots={// \rightdelim@ checks for the following:
')':true,']':true,'\\rbrack':true,'\\}':true,'\\rbrace':true,'\\rangle':true,'\\rceil':true,'\\rfloor':true,'\\rgroup':true,'\\rmoustache':true,'\\right':true,'\\bigr':true,'\\biggr':true,'\\Bigr':true,'\\Biggr':true,// \extra@ also tests for the following:
'$':true,// \extrap@ checks for the following:
';':true,'.':true,',':true};defineMacro("\\dotso",function(context){const next=context.future().text;if(next in spaceAfterDots){return "\\ldots\\,";}else{return "\\ldots";}});defineMacro("\\dotsc",function(context){const next=context.future().text;// \dotsc uses \extra@ but not \extrap@, instead specially checking for
// ';' and '.', but doesn't check for ','.
if(next in spaceAfterDots&&next!==','){return "\\ldots\\,";}else{return "\\ldots";}});defineMacro("\\cdots",function(context){const next=context.future().text;if(next in spaceAfterDots){return "\\@cdots\\,";}else{return "\\@cdots";}});defineMacro("\\dotsb","\\cdots");defineMacro("\\dotsm","\\cdots");defineMacro("\\dotsi","\\!\\cdots");// amsmath doesn't actually define \dotsx, but \dots followed by a macro
// starting with \DOTSX implies \dotso, and then \extra@ detects this case
// and forces the added `\,`.
defineMacro("\\dotsx","\\ldots\\,");// \let\DOTSI\relax
// \let\DOTSB\relax
// \let\DOTSX\relax
defineMacro("\\DOTSI","\\relax");defineMacro("\\DOTSB","\\relax");defineMacro("\\DOTSX","\\relax");// Spacing, based on amsmath.sty's override of LaTeX defaults
// \DeclareRobustCommand{\tmspace}[3]{%
//   \ifmmode\mskip#1#2\else\kern#1#3\fi\relax}
defineMacro("\\tmspace","\\TextOrMath{\\kern#1#3}{\\mskip#1#2}\\relax");// \renewcommand{\,}{\tmspace+\thinmuskip{.1667em}}
// TODO: math mode should use \thinmuskip
defineMacro("\\,","\\tmspace+{3mu}{.1667em}");// \let\thinspace\,
defineMacro("\\thinspace","\\,");// \def\>{\mskip\medmuskip}
// \renewcommand{\:}{\tmspace+\medmuskip{.2222em}}
// TODO: \> and math mode of \: should use \medmuskip = 4mu plus 2mu minus 4mu
defineMacro("\\>","\\mskip{4mu}");defineMacro("\\:","\\tmspace+{4mu}{.2222em}");// \let\medspace\:
defineMacro("\\medspace","\\:");// \renewcommand{\;}{\tmspace+\thickmuskip{.2777em}}
// TODO: math mode should use \thickmuskip = 5mu plus 5mu
defineMacro("\\;","\\tmspace+{5mu}{.2777em}");// \let\thickspace\;
defineMacro("\\thickspace","\\;");// \renewcommand{\!}{\tmspace-\thinmuskip{.1667em}}
// TODO: math mode should use \thinmuskip
defineMacro("\\!","\\tmspace-{3mu}{.1667em}");// \let\negthinspace\!
defineMacro("\\negthinspace","\\!");// \newcommand{\negmedspace}{\tmspace-\medmuskip{.2222em}}
// TODO: math mode should use \medmuskip
defineMacro("\\negmedspace","\\tmspace-{4mu}{.2222em}");// \newcommand{\negthickspace}{\tmspace-\thickmuskip{.2777em}}
// TODO: math mode should use \thickmuskip
defineMacro("\\negthickspace","\\tmspace-{5mu}{.277em}");// \def\enspace{\kern.5em }
defineMacro("\\enspace","\\kern.5em ");// \def\enskip{\hskip.5em\relax}
defineMacro("\\enskip","\\hskip.5em\\relax");// \def\quad{\hskip1em\relax}
defineMacro("\\quad","\\hskip1em\\relax");// \def\qquad{\hskip2em\relax}
defineMacro("\\qquad","\\hskip2em\\relax");// \tag@in@display form of \tag
defineMacro("\\tag","\\@ifstar\\tag@literal\\tag@paren");defineMacro("\\tag@paren","\\tag@literal{({#1})}");defineMacro("\\tag@literal",context=>{if(context.macros.get("\\df@tag")){throw new ParseError("Multiple \\tag");}return "\\gdef\\df@tag{\\text{#1}}";});// \renewcommand{\bmod}{\nonscript\mskip-\medmuskip\mkern5mu\mathbin
//   {\operator@font mod}\penalty900
//   \mkern5mu\nonscript\mskip-\medmuskip}
// \newcommand{\pod}[1]{\allowbreak
//   \if@display\mkern18mu\else\mkern8mu\fi(#1)}
// \renewcommand{\pmod}[1]{\pod{{\operator@font mod}\mkern6mu#1}}
// \newcommand{\mod}[1]{\allowbreak\if@display\mkern18mu
//   \else\mkern12mu\fi{\operator@font mod}\,\,#1}
// TODO: math mode should use \medmuskip = 4mu plus 2mu minus 4mu
defineMacro("\\bmod","\\mathchoice{\\mskip1mu}{\\mskip1mu}{\\mskip5mu}{\\mskip5mu}"+"\\mathbin{\\rm mod}"+"\\mathchoice{\\mskip1mu}{\\mskip1mu}{\\mskip5mu}{\\mskip5mu}");defineMacro("\\pod","\\allowbreak"+"\\mathchoice{\\mkern18mu}{\\mkern8mu}{\\mkern8mu}{\\mkern8mu}(#1)");defineMacro("\\pmod","\\pod{{\\rm mod}\\mkern6mu#1}");defineMacro("\\mod","\\allowbreak"+"\\mathchoice{\\mkern18mu}{\\mkern12mu}{\\mkern12mu}{\\mkern12mu}"+"{\\rm mod}\\,\\,#1");// \pmb    --   A simulation of bold.
// It works by typesetting three copies of the argument with small offsets.
// Ref: a rather lengthy macro in ambsy.sty
defineMacro("\\pmb","\\html@mathml{\\@binrel{#1}{"+"\\mathrlap{#1}"+"\\mathrlap{\\mkern0.4mu\\raisebox{0.4mu}{$#1$}}"+"{\\mkern0.8mu#1}"+"}}{\\mathbf{#1}}");//////////////////////////////////////////////////////////////////////
// LaTeX source2e
// \\ defaults to \newline, but changes to \cr within array environment
defineMacro("\\\\","\\newline");// \def\TeX{T\kern-.1667em\lower.5ex\hbox{E}\kern-.125emX\@}
// TODO: Doesn't normally work in math mode because \@ fails.  KaTeX doesn't
// support \@ yet, so that's omitted, and we add \text so that the result
// doesn't look funny in math mode.
defineMacro("\\TeX","\\textrm{\\html@mathml{"+"T\\kern-.1667em\\raisebox{-.5ex}{E}\\kern-.125emX"+"}{TeX}}");// \DeclareRobustCommand{\LaTeX}{L\kern-.36em%
//         {\sbox\z@ T%
//          \vbox to\ht\z@{\hbox{\check@mathfonts
//                               \fontsize\sf@size\z@
//                               \math@fontsfalse\selectfont
//                               A}%
//                         \vss}%
//         }%
//         \kern-.15em%
//         \TeX}
// This code aligns the top of the A with the T (from the perspective of TeX's
// boxes, though visually the A appears to extend above slightly).
// We compute the corresponding \raisebox when A is rendered at \scriptsize,
// which is size3, which has a scale factor of 0.7 (see Options.js).
const latexRaiseA=metricMap['Main-Regular']["T".charCodeAt(0)][1]-0.7*metricMap['Main-Regular']["A".charCodeAt(0)][1]+"em";defineMacro("\\LaTeX","\\textrm{\\html@mathml{"+`L\\kern-.36em\\raisebox{${latexRaiseA}}{\\scriptsize A}`+"\\kern-.15em\\TeX}{LaTeX}}");// New KaTeX logo based on tweaking LaTeX logo
defineMacro("\\KaTeX","\\textrm{\\html@mathml{"+`K\\kern-.17em\\raisebox{${latexRaiseA}}{\\scriptsize A}`+"\\kern-.15em\\TeX}{KaTeX}}");// \DeclareRobustCommand\hspace{\@ifstar\@hspacer\@hspace}
// \def\@hspace#1{\hskip  #1\relax}
// \def\@hspacer#1{\vrule \@width\z@\nobreak
//                 \hskip #1\hskip \z@skip}
defineMacro("\\hspace","\\@ifstar\\@hspacer\\@hspace");defineMacro("\\@hspace","\\hskip #1\\relax");defineMacro("\\@hspacer","\\rule{0pt}{0pt}\\hskip #1\\relax");//////////////////////////////////////////////////////////////////////
// mathtools.sty
//\providecommand\ordinarycolon{:}
defineMacro("\\ordinarycolon",":");//\def\vcentcolon{\mathrel{\mathop\ordinarycolon}}
//TODO(edemaine): Not yet centered. Fix via \raisebox or #726
defineMacro("\\vcentcolon","\\mathrel{\\mathop\\ordinarycolon}");// \providecommand*\dblcolon{\vcentcolon\mathrel{\mkern-.9mu}\vcentcolon}
defineMacro("\\dblcolon","\\mathrel{\\vcentcolon\\mathrel{\\mkern-.9mu}\\vcentcolon}");// \providecommand*\coloneqq{\vcentcolon\mathrel{\mkern-1.2mu}=}
defineMacro("\\coloneqq","\\mathrel{\\vcentcolon\\mathrel{\\mkern-1.2mu}=}");// \providecommand*\Coloneqq{\dblcolon\mathrel{\mkern-1.2mu}=}
defineMacro("\\Coloneqq","\\mathrel{\\dblcolon\\mathrel{\\mkern-1.2mu}=}");// \providecommand*\coloneq{\vcentcolon\mathrel{\mkern-1.2mu}\mathrel{-}}
defineMacro("\\coloneq","\\mathrel{\\vcentcolon\\mathrel{\\mkern-1.2mu}\\mathrel{-}}");// \providecommand*\Coloneq{\dblcolon\mathrel{\mkern-1.2mu}\mathrel{-}}
defineMacro("\\Coloneq","\\mathrel{\\dblcolon\\mathrel{\\mkern-1.2mu}\\mathrel{-}}");// \providecommand*\eqqcolon{=\mathrel{\mkern-1.2mu}\vcentcolon}
defineMacro("\\eqqcolon","\\mathrel{=\\mathrel{\\mkern-1.2mu}\\vcentcolon}");// \providecommand*\Eqqcolon{=\mathrel{\mkern-1.2mu}\dblcolon}
defineMacro("\\Eqqcolon","\\mathrel{=\\mathrel{\\mkern-1.2mu}\\dblcolon}");// \providecommand*\eqcolon{\mathrel{-}\mathrel{\mkern-1.2mu}\vcentcolon}
defineMacro("\\eqcolon","\\mathrel{\\mathrel{-}\\mathrel{\\mkern-1.2mu}\\vcentcolon}");// \providecommand*\Eqcolon{\mathrel{-}\mathrel{\mkern-1.2mu}\dblcolon}
defineMacro("\\Eqcolon","\\mathrel{\\mathrel{-}\\mathrel{\\mkern-1.2mu}\\dblcolon}");// \providecommand*\colonapprox{\vcentcolon\mathrel{\mkern-1.2mu}\approx}
defineMacro("\\colonapprox","\\mathrel{\\vcentcolon\\mathrel{\\mkern-1.2mu}\\approx}");// \providecommand*\Colonapprox{\dblcolon\mathrel{\mkern-1.2mu}\approx}
defineMacro("\\Colonapprox","\\mathrel{\\dblcolon\\mathrel{\\mkern-1.2mu}\\approx}");// \providecommand*\colonsim{\vcentcolon\mathrel{\mkern-1.2mu}\sim}
defineMacro("\\colonsim","\\mathrel{\\vcentcolon\\mathrel{\\mkern-1.2mu}\\sim}");// \providecommand*\Colonsim{\dblcolon\mathrel{\mkern-1.2mu}\sim}
defineMacro("\\Colonsim","\\mathrel{\\dblcolon\\mathrel{\\mkern-1.2mu}\\sim}");// Some Unicode characters are implemented with macros to mathtools functions.
defineMacro("\u2254","\\coloneqq");// :=
defineMacro("\u2255","\\eqqcolon");// =:
defineMacro("\u2A74","\\Coloneqq");// ::=
//////////////////////////////////////////////////////////////////////
// colonequals.sty
// Alternate names for mathtools's macros:
defineMacro("\\ratio","\\vcentcolon");defineMacro("\\coloncolon","\\dblcolon");defineMacro("\\colonequals","\\coloneqq");defineMacro("\\coloncolonequals","\\Coloneqq");defineMacro("\\equalscolon","\\eqqcolon");defineMacro("\\equalscoloncolon","\\Eqqcolon");defineMacro("\\colonminus","\\coloneq");defineMacro("\\coloncolonminus","\\Coloneq");defineMacro("\\minuscolon","\\eqcolon");defineMacro("\\minuscoloncolon","\\Eqcolon");// \colonapprox name is same in mathtools and colonequals.
defineMacro("\\coloncolonapprox","\\Colonapprox");// \colonsim name is same in mathtools and colonequals.
defineMacro("\\coloncolonsim","\\Colonsim");// Additional macros, implemented by analogy with mathtools definitions:
defineMacro("\\simcolon","\\mathrel{\\sim\\mathrel{\\mkern-1.2mu}\\vcentcolon}");defineMacro("\\simcoloncolon","\\mathrel{\\sim\\mathrel{\\mkern-1.2mu}\\dblcolon}");defineMacro("\\approxcolon","\\mathrel{\\approx\\mathrel{\\mkern-1.2mu}\\vcentcolon}");defineMacro("\\approxcoloncolon","\\mathrel{\\approx\\mathrel{\\mkern-1.2mu}\\dblcolon}");// Present in newtxmath, pxfonts and txfonts
defineMacro("\\notni","\\html@mathml{\\not\\ni}{\\mathrel{\\char`\u220C}}");defineMacro("\\limsup","\\DOTSB\\mathop{\\operatorname{lim\\,sup}}\\limits");defineMacro("\\liminf","\\DOTSB\\mathop{\\operatorname{lim\\,inf}}\\limits");//////////////////////////////////////////////////////////////////////
// semantic
// The semantic package renders the next two items by calling a glyph from the
// bbold package. Those glyphs do not exist in the KaTeX fonts. Hence the macros.
defineMacro("\u27e6","\\mathopen{[\\mkern-3.2mu[}");// blackboard bold [
defineMacro("\u27e7","\\mathclose{]\\mkern-3.2mu]}");// blackboard bold ]
// TODO: Create variable sized versions of the last two items. I believe that
// will require new font glyphs.
//////////////////////////////////////////////////////////////////////
// texvc.sty
// The texvc package contains macros available in mediawiki pages.
// We omit the functions deprecated at
// https://en.wikipedia.org/wiki/Help:Displaying_a_formula#Deprecated_syntax
// We also omit texvc's \O, which conflicts with \text{\O}
defineMacro("\\darr","\\downarrow");defineMacro("\\dArr","\\Downarrow");defineMacro("\\Darr","\\Downarrow");defineMacro("\\lang","\\langle");defineMacro("\\rang","\\rangle");defineMacro("\\uarr","\\uparrow");defineMacro("\\uArr","\\Uparrow");defineMacro("\\Uarr","\\Uparrow");defineMacro("\\N","\\mathbb{N}");defineMacro("\\R","\\mathbb{R}");defineMacro("\\Z","\\mathbb{Z}");defineMacro("\\alef","\\aleph");defineMacro("\\alefsym","\\aleph");defineMacro("\\Alpha","\\mathrm{A}");defineMacro("\\Beta","\\mathrm{B}");defineMacro("\\bull","\\bullet");defineMacro("\\Chi","\\mathrm{X}");defineMacro("\\clubs","\\clubsuit");defineMacro("\\cnums","\\mathbb{C}");defineMacro("\\Complex","\\mathbb{C}");defineMacro("\\Dagger","\\ddagger");defineMacro("\\diamonds","\\diamondsuit");defineMacro("\\empty","\\emptyset");defineMacro("\\Epsilon","\\mathrm{E}");defineMacro("\\Eta","\\mathrm{H}");defineMacro("\\exist","\\exists");defineMacro("\\harr","\\leftrightarrow");defineMacro("\\hArr","\\Leftrightarrow");defineMacro("\\Harr","\\Leftrightarrow");defineMacro("\\hearts","\\heartsuit");defineMacro("\\image","\\Im");defineMacro("\\infin","\\infty");defineMacro("\\Iota","\\mathrm{I}");defineMacro("\\isin","\\in");defineMacro("\\Kappa","\\mathrm{K}");defineMacro("\\larr","\\leftarrow");defineMacro("\\lArr","\\Leftarrow");defineMacro("\\Larr","\\Leftarrow");defineMacro("\\lrarr","\\leftrightarrow");defineMacro("\\lrArr","\\Leftrightarrow");defineMacro("\\Lrarr","\\Leftrightarrow");defineMacro("\\Mu","\\mathrm{M}");defineMacro("\\natnums","\\mathbb{N}");defineMacro("\\Nu","\\mathrm{N}");defineMacro("\\Omicron","\\mathrm{O}");defineMacro("\\plusmn","\\pm");defineMacro("\\rarr","\\rightarrow");defineMacro("\\rArr","\\Rightarrow");defineMacro("\\Rarr","\\Rightarrow");defineMacro("\\real","\\Re");defineMacro("\\reals","\\mathbb{R}");defineMacro("\\Reals","\\mathbb{R}");defineMacro("\\Rho","\\mathrm{R}");defineMacro("\\sdot","\\cdot");defineMacro("\\sect","\\S");defineMacro("\\spades","\\spadesuit");defineMacro("\\sub","\\subset");defineMacro("\\sube","\\subseteq");defineMacro("\\supe","\\supseteq");defineMacro("\\Tau","\\mathrm{T}");defineMacro("\\thetasym","\\vartheta");// TODO: defineMacro("\\varcoppa", "\\\mbox{\\coppa}");
defineMacro("\\weierp","\\wp");defineMacro("\\Zeta","\\mathrm{Z}");//////////////////////////////////////////////////////////////////////
// statmath.sty
// https://ctan.math.illinois.edu/macros/latex/contrib/statmath/statmath.pdf
defineMacro("\\argmin","\\DOTSB\\mathop{\\operatorname{arg\\,min}}\\limits");defineMacro("\\argmax","\\DOTSB\\mathop{\\operatorname{arg\\,max}}\\limits");/**
 * This file contains the “gullet” where macros are expanded
 * until only non-macro tokens remain.
 */ // List of commands that act like macros but aren't defined as a macro,
// function, or symbol.  Used in `isDefined`.
const implicitCommands={"\\relax":true,// MacroExpander.js
"^":true,// Parser.js
"_":true,// Parser.js
"\\limits":true,// Parser.js
"\\nolimits":true// Parser.js
};class MacroExpander{constructor(input,settings,mode){this.settings=void 0;this.expansionCount=void 0;this.lexer=void 0;this.macros=void 0;this.stack=void 0;this.mode=void 0;this.settings=settings;this.expansionCount=0;this.feed(input);// Make new global namespace
this.macros=new Namespace(builtinMacros,settings.macros);this.mode=mode;this.stack=[];// contains tokens in REVERSE order
}/**
   * Feed a new input string to the same MacroExpander
   * (with existing macros etc.).
   */feed(input){this.lexer=new Lexer(input,this.settings);}/**
   * Switches between "text" and "math" modes.
   */switchMode(newMode){this.mode=newMode;}/**
   * Start a new group nesting within all namespaces.
   */beginGroup(){this.macros.beginGroup();}/**
   * End current group nesting within all namespaces.
   */endGroup(){this.macros.endGroup();}/**
   * Returns the topmost token on the stack, without expanding it.
   * Similar in behavior to TeX's `\futurelet`.
   */future(){if(this.stack.length===0){this.pushToken(this.lexer.lex());}return this.stack[this.stack.length-1];}/**
   * Remove and return the next unexpanded token.
   */popToken(){this.future();// ensure non-empty stack
return this.stack.pop();}/**
   * Add a given token to the token stack.  In particular, this get be used
   * to put back a token returned from one of the other methods.
   */pushToken(token){this.stack.push(token);}/**
   * Append an array of tokens to the token stack.
   */pushTokens(tokens){this.stack.push(...tokens);}/**
   * Consume all following space tokens, without expansion.
   */consumeSpaces(){for(;;){const token=this.future();if(token.text===" "){this.stack.pop();}else{break;}}}/**
   * Consume the specified number of arguments from the token stream,
   * and return the resulting array of arguments.
   */consumeArgs(numArgs){const args=[];// obtain arguments, either single token or balanced {…} group
for(let i=0;i<numArgs;++i){this.consumeSpaces();// ignore spaces before each argument
const startOfArg=this.popToken();if(startOfArg.text==="{"){const arg=[];let depth=1;while(depth!==0){const tok=this.popToken();arg.push(tok);if(tok.text==="{"){++depth;}else if(tok.text==="}"){--depth;}else if(tok.text==="EOF"){throw new ParseError("End of input in macro argument",startOfArg);}}arg.pop();// remove last }
arg.reverse();// like above, to fit in with stack order
args[i]=arg;}else if(startOfArg.text==="EOF"){throw new ParseError("End of input expecting macro argument");}else{args[i]=[startOfArg];}}return args;}/**
   * Expand the next token only once if possible.
   *
   * If the token is expanded, the resulting tokens will be pushed onto
   * the stack in reverse order and will be returned as an array,
   * also in reverse order.
   *
   * If not, the next token will be returned without removing it
   * from the stack.  This case can be detected by a `Token` return value
   * instead of an `Array` return value.
   *
   * In either case, the next token will be on the top of the stack,
   * or the stack will be empty.
   *
   * Used to implement `expandAfterFuture` and `expandNextToken`.
   *
   * At the moment, macro expansion doesn't handle delimited macros,
   * i.e. things like those defined by \def\foo#1\end{…}.
   * See the TeX book page 202ff. for details on how those should behave.
   */expandOnce(){const topToken=this.popToken();const name=topToken.text;const expansion=this._getExpansion(name);if(expansion==null){// mainly checking for undefined here
// Fully expanded
this.pushToken(topToken);return topToken;}this.expansionCount++;if(this.expansionCount>this.settings.maxExpand){throw new ParseError("Too many expansions: infinite loop or "+"need to increase maxExpand setting");}let tokens=expansion.tokens;if(expansion.numArgs){const args=this.consumeArgs(expansion.numArgs);// paste arguments in place of the placeholders
tokens=tokens.slice();// make a shallow copy
for(let i=tokens.length-1;i>=0;--i){let tok=tokens[i];if(tok.text==="#"){if(i===0){throw new ParseError("Incomplete placeholder at end of macro body",tok);}tok=tokens[--i];// next token on stack
if(tok.text==="#"){// ## → #
tokens.splice(i+1,1);// drop first #
}else if(/^[1-9]$/.test(tok.text)){// replace the placeholder with the indicated argument
tokens.splice(i,2,...args[+tok.text-1]);}else{throw new ParseError("Not a valid argument number",tok);}}}}// Concatenate expansion onto top of stack.
this.pushTokens(tokens);return tokens;}/**
   * Expand the next token only once (if possible), and return the resulting
   * top token on the stack (without removing anything from the stack).
   * Similar in behavior to TeX's `\expandafter\futurelet`.
   * Equivalent to expandOnce() followed by future().
   */expandAfterFuture(){this.expandOnce();return this.future();}/**
   * Recursively expand first token, then return first non-expandable token.
   */expandNextToken(){for(;;){const expanded=this.expandOnce();// expandOnce returns Token if and only if it's fully expanded.
if(expanded instanceof Token){// \relax stops the expansion, but shouldn't get returned (a
// null return value couldn't get implemented as a function).
if(expanded.text==="\\relax"){this.stack.pop();}else{return this.stack.pop();// === expanded
}}}// Flow unable to figure out that this pathway is impossible.
// https://github.com/facebook/flow/issues/4808
throw new Error();// eslint-disable-line no-unreachable
}/**
   * Fully expand the given macro name and return the resulting list of
   * tokens, or return `undefined` if no such macro is defined.
   */expandMacro(name){if(!this.macros.get(name)){return undefined;}const output=[];const oldStackLength=this.stack.length;this.pushToken(new Token(name));while(this.stack.length>oldStackLength){const expanded=this.expandOnce();// expandOnce returns Token if and only if it's fully expanded.
if(expanded instanceof Token){output.push(this.stack.pop());}}return output;}/**
   * Fully expand the given macro name and return the result as a string,
   * or return `undefined` if no such macro is defined.
   */expandMacroAsText(name){const tokens=this.expandMacro(name);if(tokens){return tokens.map(token=>token.text).join("");}else{return tokens;}}/**
   * Returns the expanded macro as a reversed array of tokens and a macro
   * argument count.  Or returns `null` if no such macro.
   */_getExpansion(name){const definition=this.macros.get(name);if(definition==null){// mainly checking for undefined here
return definition;}const expansion=typeof definition==="function"?definition(this):definition;if(typeof expansion==="string"){let numArgs=0;if(expansion.indexOf("#")!==-1){const stripped=expansion.replace(/##/g,"");while(stripped.indexOf("#"+(numArgs+1))!==-1){++numArgs;}}const bodyLexer=new Lexer(expansion,this.settings);const tokens=[];let tok=bodyLexer.lex();while(tok.text!=="EOF"){tokens.push(tok);tok=bodyLexer.lex();}tokens.reverse();// to fit in with stack using push and pop
const expanded={tokens,numArgs};return expanded;}return expansion;}/**
   * Determine whether a command is currently "defined" (has some
   * functionality), meaning that it's a macro (in the current group),
   * a function, a symbol, or one of the special commands listed in
   * `implicitCommands`.
   */isDefined(name){return this.macros.has(name)||functions.hasOwnProperty(name)||symbols.math.hasOwnProperty(name)||symbols.text.hasOwnProperty(name)||implicitCommands.hasOwnProperty(name);}}// Mapping of Unicode accent characters to their LaTeX equivalent in text and
// math mode (when they exist).
var unicodeAccents={'\u0301':{text:"\\'",math:'\\acute'},'\u0300':{text:'\\`',math:'\\grave'},'\u0308':{text:'\\"',math:'\\ddot'},'\u0303':{text:'\\~',math:'\\tilde'},'\u0304':{text:'\\=',math:'\\bar'},'\u0306':{text:'\\u',math:'\\breve'},'\u030c':{text:'\\v',math:'\\check'},'\u0302':{text:'\\^',math:'\\hat'},'\u0307':{text:'\\.',math:'\\dot'},'\u030a':{text:'\\r',math:'\\mathring'},'\u030b':{text:'\\H'}};// This file is GENERATED by unicodeMake.js. DO NOT MODIFY.
var unicodeSymbols={"\u00e1":"\u0061\u0301",// á = \'{a}
"\u00e0":"\u0061\u0300",// à = \`{a}
"\u00e4":"\u0061\u0308",// ä = \"{a}
"\u01df":"\u0061\u0308\u0304",// ǟ = \"\={a}
"\u00e3":"\u0061\u0303",// ã = \~{a}
"\u0101":"\u0061\u0304",// ā = \={a}
"\u0103":"\u0061\u0306",// ă = \u{a}
"\u1eaf":"\u0061\u0306\u0301",// ắ = \u\'{a}
"\u1eb1":"\u0061\u0306\u0300",// ằ = \u\`{a}
"\u1eb5":"\u0061\u0306\u0303",// ẵ = \u\~{a}
"\u01ce":"\u0061\u030c",// ǎ = \v{a}
"\u00e2":"\u0061\u0302",// â = \^{a}
"\u1ea5":"\u0061\u0302\u0301",// ấ = \^\'{a}
"\u1ea7":"\u0061\u0302\u0300",// ầ = \^\`{a}
"\u1eab":"\u0061\u0302\u0303",// ẫ = \^\~{a}
"\u0227":"\u0061\u0307",// ȧ = \.{a}
"\u01e1":"\u0061\u0307\u0304",// ǡ = \.\={a}
"\u00e5":"\u0061\u030a",// å = \r{a}
"\u01fb":"\u0061\u030a\u0301",// ǻ = \r\'{a}
"\u1e03":"\u0062\u0307",// ḃ = \.{b}
"\u0107":"\u0063\u0301",// ć = \'{c}
"\u010d":"\u0063\u030c",// č = \v{c}
"\u0109":"\u0063\u0302",// ĉ = \^{c}
"\u010b":"\u0063\u0307",// ċ = \.{c}
"\u010f":"\u0064\u030c",// ď = \v{d}
"\u1e0b":"\u0064\u0307",// ḋ = \.{d}
"\u00e9":"\u0065\u0301",// é = \'{e}
"\u00e8":"\u0065\u0300",// è = \`{e}
"\u00eb":"\u0065\u0308",// ë = \"{e}
"\u1ebd":"\u0065\u0303",// ẽ = \~{e}
"\u0113":"\u0065\u0304",// ē = \={e}
"\u1e17":"\u0065\u0304\u0301",// ḗ = \=\'{e}
"\u1e15":"\u0065\u0304\u0300",// ḕ = \=\`{e}
"\u0115":"\u0065\u0306",// ĕ = \u{e}
"\u011b":"\u0065\u030c",// ě = \v{e}
"\u00ea":"\u0065\u0302",// ê = \^{e}
"\u1ebf":"\u0065\u0302\u0301",// ế = \^\'{e}
"\u1ec1":"\u0065\u0302\u0300",// ề = \^\`{e}
"\u1ec5":"\u0065\u0302\u0303",// ễ = \^\~{e}
"\u0117":"\u0065\u0307",// ė = \.{e}
"\u1e1f":"\u0066\u0307",// ḟ = \.{f}
"\u01f5":"\u0067\u0301",// ǵ = \'{g}
"\u1e21":"\u0067\u0304",// ḡ = \={g}
"\u011f":"\u0067\u0306",// ğ = \u{g}
"\u01e7":"\u0067\u030c",// ǧ = \v{g}
"\u011d":"\u0067\u0302",// ĝ = \^{g}
"\u0121":"\u0067\u0307",// ġ = \.{g}
"\u1e27":"\u0068\u0308",// ḧ = \"{h}
"\u021f":"\u0068\u030c",// ȟ = \v{h}
"\u0125":"\u0068\u0302",// ĥ = \^{h}
"\u1e23":"\u0068\u0307",// ḣ = \.{h}
"\u00ed":"\u0069\u0301",// í = \'{i}
"\u00ec":"\u0069\u0300",// ì = \`{i}
"\u00ef":"\u0069\u0308",// ï = \"{i}
"\u1e2f":"\u0069\u0308\u0301",// ḯ = \"\'{i}
"\u0129":"\u0069\u0303",// ĩ = \~{i}
"\u012b":"\u0069\u0304",// ī = \={i}
"\u012d":"\u0069\u0306",// ĭ = \u{i}
"\u01d0":"\u0069\u030c",// ǐ = \v{i}
"\u00ee":"\u0069\u0302",// î = \^{i}
"\u01f0":"\u006a\u030c",// ǰ = \v{j}
"\u0135":"\u006a\u0302",// ĵ = \^{j}
"\u1e31":"\u006b\u0301",// ḱ = \'{k}
"\u01e9":"\u006b\u030c",// ǩ = \v{k}
"\u013a":"\u006c\u0301",// ĺ = \'{l}
"\u013e":"\u006c\u030c",// ľ = \v{l}
"\u1e3f":"\u006d\u0301",// ḿ = \'{m}
"\u1e41":"\u006d\u0307",// ṁ = \.{m}
"\u0144":"\u006e\u0301",// ń = \'{n}
"\u01f9":"\u006e\u0300",// ǹ = \`{n}
"\u00f1":"\u006e\u0303",// ñ = \~{n}
"\u0148":"\u006e\u030c",// ň = \v{n}
"\u1e45":"\u006e\u0307",// ṅ = \.{n}
"\u00f3":"\u006f\u0301",// ó = \'{o}
"\u00f2":"\u006f\u0300",// ò = \`{o}
"\u00f6":"\u006f\u0308",// ö = \"{o}
"\u022b":"\u006f\u0308\u0304",// ȫ = \"\={o}
"\u00f5":"\u006f\u0303",// õ = \~{o}
"\u1e4d":"\u006f\u0303\u0301",// ṍ = \~\'{o}
"\u1e4f":"\u006f\u0303\u0308",// ṏ = \~\"{o}
"\u022d":"\u006f\u0303\u0304",// ȭ = \~\={o}
"\u014d":"\u006f\u0304",// ō = \={o}
"\u1e53":"\u006f\u0304\u0301",// ṓ = \=\'{o}
"\u1e51":"\u006f\u0304\u0300",// ṑ = \=\`{o}
"\u014f":"\u006f\u0306",// ŏ = \u{o}
"\u01d2":"\u006f\u030c",// ǒ = \v{o}
"\u00f4":"\u006f\u0302",// ô = \^{o}
"\u1ed1":"\u006f\u0302\u0301",// ố = \^\'{o}
"\u1ed3":"\u006f\u0302\u0300",// ồ = \^\`{o}
"\u1ed7":"\u006f\u0302\u0303",// ỗ = \^\~{o}
"\u022f":"\u006f\u0307",// ȯ = \.{o}
"\u0231":"\u006f\u0307\u0304",// ȱ = \.\={o}
"\u0151":"\u006f\u030b",// ő = \H{o}
"\u1e55":"\u0070\u0301",// ṕ = \'{p}
"\u1e57":"\u0070\u0307",// ṗ = \.{p}
"\u0155":"\u0072\u0301",// ŕ = \'{r}
"\u0159":"\u0072\u030c",// ř = \v{r}
"\u1e59":"\u0072\u0307",// ṙ = \.{r}
"\u015b":"\u0073\u0301",// ś = \'{s}
"\u1e65":"\u0073\u0301\u0307",// ṥ = \'\.{s}
"\u0161":"\u0073\u030c",// š = \v{s}
"\u1e67":"\u0073\u030c\u0307",// ṧ = \v\.{s}
"\u015d":"\u0073\u0302",// ŝ = \^{s}
"\u1e61":"\u0073\u0307",// ṡ = \.{s}
"\u1e97":"\u0074\u0308",// ẗ = \"{t}
"\u0165":"\u0074\u030c",// ť = \v{t}
"\u1e6b":"\u0074\u0307",// ṫ = \.{t}
"\u00fa":"\u0075\u0301",// ú = \'{u}
"\u00f9":"\u0075\u0300",// ù = \`{u}
"\u00fc":"\u0075\u0308",// ü = \"{u}
"\u01d8":"\u0075\u0308\u0301",// ǘ = \"\'{u}
"\u01dc":"\u0075\u0308\u0300",// ǜ = \"\`{u}
"\u01d6":"\u0075\u0308\u0304",// ǖ = \"\={u}
"\u01da":"\u0075\u0308\u030c",// ǚ = \"\v{u}
"\u0169":"\u0075\u0303",// ũ = \~{u}
"\u1e79":"\u0075\u0303\u0301",// ṹ = \~\'{u}
"\u016b":"\u0075\u0304",// ū = \={u}
"\u1e7b":"\u0075\u0304\u0308",// ṻ = \=\"{u}
"\u016d":"\u0075\u0306",// ŭ = \u{u}
"\u01d4":"\u0075\u030c",// ǔ = \v{u}
"\u00fb":"\u0075\u0302",// û = \^{u}
"\u016f":"\u0075\u030a",// ů = \r{u}
"\u0171":"\u0075\u030b",// ű = \H{u}
"\u1e7d":"\u0076\u0303",// ṽ = \~{v}
"\u1e83":"\u0077\u0301",// ẃ = \'{w}
"\u1e81":"\u0077\u0300",// ẁ = \`{w}
"\u1e85":"\u0077\u0308",// ẅ = \"{w}
"\u0175":"\u0077\u0302",// ŵ = \^{w}
"\u1e87":"\u0077\u0307",// ẇ = \.{w}
"\u1e98":"\u0077\u030a",// ẘ = \r{w}
"\u1e8d":"\u0078\u0308",// ẍ = \"{x}
"\u1e8b":"\u0078\u0307",// ẋ = \.{x}
"\u00fd":"\u0079\u0301",// ý = \'{y}
"\u1ef3":"\u0079\u0300",// ỳ = \`{y}
"\u00ff":"\u0079\u0308",// ÿ = \"{y}
"\u1ef9":"\u0079\u0303",// ỹ = \~{y}
"\u0233":"\u0079\u0304",// ȳ = \={y}
"\u0177":"\u0079\u0302",// ŷ = \^{y}
"\u1e8f":"\u0079\u0307",// ẏ = \.{y}
"\u1e99":"\u0079\u030a",// ẙ = \r{y}
"\u017a":"\u007a\u0301",// ź = \'{z}
"\u017e":"\u007a\u030c",// ž = \v{z}
"\u1e91":"\u007a\u0302",// ẑ = \^{z}
"\u017c":"\u007a\u0307",// ż = \.{z}
"\u00c1":"\u0041\u0301",// Á = \'{A}
"\u00c0":"\u0041\u0300",// À = \`{A}
"\u00c4":"\u0041\u0308",// Ä = \"{A}
"\u01de":"\u0041\u0308\u0304",// Ǟ = \"\={A}
"\u00c3":"\u0041\u0303",// Ã = \~{A}
"\u0100":"\u0041\u0304",// Ā = \={A}
"\u0102":"\u0041\u0306",// Ă = \u{A}
"\u1eae":"\u0041\u0306\u0301",// Ắ = \u\'{A}
"\u1eb0":"\u0041\u0306\u0300",// Ằ = \u\`{A}
"\u1eb4":"\u0041\u0306\u0303",// Ẵ = \u\~{A}
"\u01cd":"\u0041\u030c",// Ǎ = \v{A}
"\u00c2":"\u0041\u0302",// Â = \^{A}
"\u1ea4":"\u0041\u0302\u0301",// Ấ = \^\'{A}
"\u1ea6":"\u0041\u0302\u0300",// Ầ = \^\`{A}
"\u1eaa":"\u0041\u0302\u0303",// Ẫ = \^\~{A}
"\u0226":"\u0041\u0307",// Ȧ = \.{A}
"\u01e0":"\u0041\u0307\u0304",// Ǡ = \.\={A}
"\u00c5":"\u0041\u030a",// Å = \r{A}
"\u01fa":"\u0041\u030a\u0301",// Ǻ = \r\'{A}
"\u1e02":"\u0042\u0307",// Ḃ = \.{B}
"\u0106":"\u0043\u0301",// Ć = \'{C}
"\u010c":"\u0043\u030c",// Č = \v{C}
"\u0108":"\u0043\u0302",// Ĉ = \^{C}
"\u010a":"\u0043\u0307",// Ċ = \.{C}
"\u010e":"\u0044\u030c",// Ď = \v{D}
"\u1e0a":"\u0044\u0307",// Ḋ = \.{D}
"\u00c9":"\u0045\u0301",// É = \'{E}
"\u00c8":"\u0045\u0300",// È = \`{E}
"\u00cb":"\u0045\u0308",// Ë = \"{E}
"\u1ebc":"\u0045\u0303",// Ẽ = \~{E}
"\u0112":"\u0045\u0304",// Ē = \={E}
"\u1e16":"\u0045\u0304\u0301",// Ḗ = \=\'{E}
"\u1e14":"\u0045\u0304\u0300",// Ḕ = \=\`{E}
"\u0114":"\u0045\u0306",// Ĕ = \u{E}
"\u011a":"\u0045\u030c",// Ě = \v{E}
"\u00ca":"\u0045\u0302",// Ê = \^{E}
"\u1ebe":"\u0045\u0302\u0301",// Ế = \^\'{E}
"\u1ec0":"\u0045\u0302\u0300",// Ề = \^\`{E}
"\u1ec4":"\u0045\u0302\u0303",// Ễ = \^\~{E}
"\u0116":"\u0045\u0307",// Ė = \.{E}
"\u1e1e":"\u0046\u0307",// Ḟ = \.{F}
"\u01f4":"\u0047\u0301",// Ǵ = \'{G}
"\u1e20":"\u0047\u0304",// Ḡ = \={G}
"\u011e":"\u0047\u0306",// Ğ = \u{G}
"\u01e6":"\u0047\u030c",// Ǧ = \v{G}
"\u011c":"\u0047\u0302",// Ĝ = \^{G}
"\u0120":"\u0047\u0307",// Ġ = \.{G}
"\u1e26":"\u0048\u0308",// Ḧ = \"{H}
"\u021e":"\u0048\u030c",// Ȟ = \v{H}
"\u0124":"\u0048\u0302",// Ĥ = \^{H}
"\u1e22":"\u0048\u0307",// Ḣ = \.{H}
"\u00cd":"\u0049\u0301",// Í = \'{I}
"\u00cc":"\u0049\u0300",// Ì = \`{I}
"\u00cf":"\u0049\u0308",// Ï = \"{I}
"\u1e2e":"\u0049\u0308\u0301",// Ḯ = \"\'{I}
"\u0128":"\u0049\u0303",// Ĩ = \~{I}
"\u012a":"\u0049\u0304",// Ī = \={I}
"\u012c":"\u0049\u0306",// Ĭ = \u{I}
"\u01cf":"\u0049\u030c",// Ǐ = \v{I}
"\u00ce":"\u0049\u0302",// Î = \^{I}
"\u0130":"\u0049\u0307",// İ = \.{I}
"\u0134":"\u004a\u0302",// Ĵ = \^{J}
"\u1e30":"\u004b\u0301",// Ḱ = \'{K}
"\u01e8":"\u004b\u030c",// Ǩ = \v{K}
"\u0139":"\u004c\u0301",// Ĺ = \'{L}
"\u013d":"\u004c\u030c",// Ľ = \v{L}
"\u1e3e":"\u004d\u0301",// Ḿ = \'{M}
"\u1e40":"\u004d\u0307",// Ṁ = \.{M}
"\u0143":"\u004e\u0301",// Ń = \'{N}
"\u01f8":"\u004e\u0300",// Ǹ = \`{N}
"\u00d1":"\u004e\u0303",// Ñ = \~{N}
"\u0147":"\u004e\u030c",// Ň = \v{N}
"\u1e44":"\u004e\u0307",// Ṅ = \.{N}
"\u00d3":"\u004f\u0301",// Ó = \'{O}
"\u00d2":"\u004f\u0300",// Ò = \`{O}
"\u00d6":"\u004f\u0308",// Ö = \"{O}
"\u022a":"\u004f\u0308\u0304",// Ȫ = \"\={O}
"\u00d5":"\u004f\u0303",// Õ = \~{O}
"\u1e4c":"\u004f\u0303\u0301",// Ṍ = \~\'{O}
"\u1e4e":"\u004f\u0303\u0308",// Ṏ = \~\"{O}
"\u022c":"\u004f\u0303\u0304",// Ȭ = \~\={O}
"\u014c":"\u004f\u0304",// Ō = \={O}
"\u1e52":"\u004f\u0304\u0301",// Ṓ = \=\'{O}
"\u1e50":"\u004f\u0304\u0300",// Ṑ = \=\`{O}
"\u014e":"\u004f\u0306",// Ŏ = \u{O}
"\u01d1":"\u004f\u030c",// Ǒ = \v{O}
"\u00d4":"\u004f\u0302",// Ô = \^{O}
"\u1ed0":"\u004f\u0302\u0301",// Ố = \^\'{O}
"\u1ed2":"\u004f\u0302\u0300",// Ồ = \^\`{O}
"\u1ed6":"\u004f\u0302\u0303",// Ỗ = \^\~{O}
"\u022e":"\u004f\u0307",// Ȯ = \.{O}
"\u0230":"\u004f\u0307\u0304",// Ȱ = \.\={O}
"\u0150":"\u004f\u030b",// Ő = \H{O}
"\u1e54":"\u0050\u0301",// Ṕ = \'{P}
"\u1e56":"\u0050\u0307",// Ṗ = \.{P}
"\u0154":"\u0052\u0301",// Ŕ = \'{R}
"\u0158":"\u0052\u030c",// Ř = \v{R}
"\u1e58":"\u0052\u0307",// Ṙ = \.{R}
"\u015a":"\u0053\u0301",// Ś = \'{S}
"\u1e64":"\u0053\u0301\u0307",// Ṥ = \'\.{S}
"\u0160":"\u0053\u030c",// Š = \v{S}
"\u1e66":"\u0053\u030c\u0307",// Ṧ = \v\.{S}
"\u015c":"\u0053\u0302",// Ŝ = \^{S}
"\u1e60":"\u0053\u0307",// Ṡ = \.{S}
"\u0164":"\u0054\u030c",// Ť = \v{T}
"\u1e6a":"\u0054\u0307",// Ṫ = \.{T}
"\u00da":"\u0055\u0301",// Ú = \'{U}
"\u00d9":"\u0055\u0300",// Ù = \`{U}
"\u00dc":"\u0055\u0308",// Ü = \"{U}
"\u01d7":"\u0055\u0308\u0301",// Ǘ = \"\'{U}
"\u01db":"\u0055\u0308\u0300",// Ǜ = \"\`{U}
"\u01d5":"\u0055\u0308\u0304",// Ǖ = \"\={U}
"\u01d9":"\u0055\u0308\u030c",// Ǚ = \"\v{U}
"\u0168":"\u0055\u0303",// Ũ = \~{U}
"\u1e78":"\u0055\u0303\u0301",// Ṹ = \~\'{U}
"\u016a":"\u0055\u0304",// Ū = \={U}
"\u1e7a":"\u0055\u0304\u0308",// Ṻ = \=\"{U}
"\u016c":"\u0055\u0306",// Ŭ = \u{U}
"\u01d3":"\u0055\u030c",// Ǔ = \v{U}
"\u00db":"\u0055\u0302",// Û = \^{U}
"\u016e":"\u0055\u030a",// Ů = \r{U}
"\u0170":"\u0055\u030b",// Ű = \H{U}
"\u1e7c":"\u0056\u0303",// Ṽ = \~{V}
"\u1e82":"\u0057\u0301",// Ẃ = \'{W}
"\u1e80":"\u0057\u0300",// Ẁ = \`{W}
"\u1e84":"\u0057\u0308",// Ẅ = \"{W}
"\u0174":"\u0057\u0302",// Ŵ = \^{W}
"\u1e86":"\u0057\u0307",// Ẇ = \.{W}
"\u1e8c":"\u0058\u0308",// Ẍ = \"{X}
"\u1e8a":"\u0058\u0307",// Ẋ = \.{X}
"\u00dd":"\u0059\u0301",// Ý = \'{Y}
"\u1ef2":"\u0059\u0300",// Ỳ = \`{Y}
"\u0178":"\u0059\u0308",// Ÿ = \"{Y}
"\u1ef8":"\u0059\u0303",// Ỹ = \~{Y}
"\u0232":"\u0059\u0304",// Ȳ = \={Y}
"\u0176":"\u0059\u0302",// Ŷ = \^{Y}
"\u1e8e":"\u0059\u0307",// Ẏ = \.{Y}
"\u0179":"\u005a\u0301",// Ź = \'{Z}
"\u017d":"\u005a\u030c",// Ž = \v{Z}
"\u1e90":"\u005a\u0302",// Ẑ = \^{Z}
"\u017b":"\u005a\u0307",// Ż = \.{Z}
"\u03ac":"\u03b1\u0301",// ά = \'{α}
"\u1f70":"\u03b1\u0300",// ὰ = \`{α}
"\u1fb1":"\u03b1\u0304",// ᾱ = \={α}
"\u1fb0":"\u03b1\u0306",// ᾰ = \u{α}
"\u03ad":"\u03b5\u0301",// έ = \'{ε}
"\u1f72":"\u03b5\u0300",// ὲ = \`{ε}
"\u03ae":"\u03b7\u0301",// ή = \'{η}
"\u1f74":"\u03b7\u0300",// ὴ = \`{η}
"\u03af":"\u03b9\u0301",// ί = \'{ι}
"\u1f76":"\u03b9\u0300",// ὶ = \`{ι}
"\u03ca":"\u03b9\u0308",// ϊ = \"{ι}
"\u0390":"\u03b9\u0308\u0301",// ΐ = \"\'{ι}
"\u1fd2":"\u03b9\u0308\u0300",// ῒ = \"\`{ι}
"\u1fd1":"\u03b9\u0304",// ῑ = \={ι}
"\u1fd0":"\u03b9\u0306",// ῐ = \u{ι}
"\u03cc":"\u03bf\u0301",// ό = \'{ο}
"\u1f78":"\u03bf\u0300",// ὸ = \`{ο}
"\u03cd":"\u03c5\u0301",// ύ = \'{υ}
"\u1f7a":"\u03c5\u0300",// ὺ = \`{υ}
"\u03cb":"\u03c5\u0308",// ϋ = \"{υ}
"\u03b0":"\u03c5\u0308\u0301",// ΰ = \"\'{υ}
"\u1fe2":"\u03c5\u0308\u0300",// ῢ = \"\`{υ}
"\u1fe1":"\u03c5\u0304",// ῡ = \={υ}
"\u1fe0":"\u03c5\u0306",// ῠ = \u{υ}
"\u03ce":"\u03c9\u0301",// ώ = \'{ω}
"\u1f7c":"\u03c9\u0300",// ὼ = \`{ω}
"\u038e":"\u03a5\u0301",// Ύ = \'{Υ}
"\u1fea":"\u03a5\u0300",// Ὺ = \`{Υ}
"\u03ab":"\u03a5\u0308",// Ϋ = \"{Υ}
"\u1fe9":"\u03a5\u0304",// Ῡ = \={Υ}
"\u1fe8":"\u03a5\u0306",// Ῠ = \u{Υ}
"\u038f":"\u03a9\u0301",// Ώ = \'{Ω}
"\u1ffa":"\u03a9\u0300"// Ὼ = \`{Ω}
};/* eslint no-constant-condition:0 */ /**
 * This file contains the parser used to parse out a TeX expression from the
 * input. Since TeX isn't context-free, standard parsers don't work particularly
 * well.
 *
 * The strategy of this parser is as such:
 *
 * The main functions (the `.parse...` ones) take a position in the current
 * parse string to parse tokens from. The lexer (found in Lexer.js, stored at
 * this.gullet.lexer) also supports pulling out tokens at arbitrary places. When
 * individual tokens are needed at a position, the lexer is called to pull out a
 * token, which is then used.
 *
 * The parser has a property called "mode" indicating the mode that
 * the parser is currently in. Currently it has to be one of "math" or
 * "text", which denotes whether the current environment is a math-y
 * one or a text-y one (e.g. inside \text). Currently, this serves to
 * limit the functions which can be used in text mode.
 *
 * The main functions then return an object which contains the useful data that
 * was parsed at its given point, and a new position at the end of the parsed
 * data. The main functions can call each other and continue the parsing by
 * using the returned position as a new starting point.
 *
 * There are also extra `.handle...` functions, which pull out some reused
 * functionality into self-contained functions.
 *
 * The functions return ParseNodes.
 */class Parser{constructor(input,settings){this.mode=void 0;this.gullet=void 0;this.settings=void 0;this.leftrightDepth=void 0;this.nextToken=void 0;// Start in math mode
this.mode="math";// Create a new macro expander (gullet) and (indirectly via that) also a
// new lexer (mouth) for this parser (stomach, in the language of TeX)
this.gullet=new MacroExpander(input,settings,this.mode);// Store the settings for use in parsing
this.settings=settings;// Count leftright depth (for \middle errors)
this.leftrightDepth=0;}/**
   * Checks a result to make sure it has the right type, and throws an
   * appropriate error otherwise.
   */expect(text,consume){if(consume===void 0){consume=true;}if(this.nextToken.text!==text){throw new ParseError("Expected '"+text+"', got '"+this.nextToken.text+"'",this.nextToken);}if(consume){this.consume();}}/**
   * Considers the current look ahead token as consumed,
   * and fetches the one after that as the new look ahead.
   */consume(){this.nextToken=this.gullet.expandNextToken();}/**
   * Switches between "text" and "math" modes.
   */switchMode(newMode){this.mode=newMode;this.gullet.switchMode(newMode);}/**
   * Main parsing function, which parses an entire input.
   */parse(){// Create a group namespace for the math expression.
// (LaTeX creates a new group for every $...$, $$...$$, \[...\].)
this.gullet.beginGroup();// Use old \color behavior (same as LaTeX's \textcolor) if requested.
// We do this within the group for the math expression, so it doesn't
// pollute settings.macros.
if(this.settings.colorIsTextColor){this.gullet.macros.set("\\color","\\textcolor");}// Try to parse the input
this.consume();const parse=this.parseExpression(false);// If we succeeded, make sure there's an EOF at the end
this.expect("EOF",false);// End the group namespace for the expression
this.gullet.endGroup();return parse;}parseExpression(breakOnInfix,breakOnTokenText){const body=[];// Keep adding atoms to the body until we can't parse any more atoms (either
// we reached the end, a }, or a \right)
while(true){// Ignore spaces in math mode
if(this.mode==="math"){this.consumeSpaces();}const lex=this.nextToken;if(Parser.endOfExpression.indexOf(lex.text)!==-1){break;}if(breakOnTokenText&&lex.text===breakOnTokenText){break;}if(breakOnInfix&&functions[lex.text]&&functions[lex.text].infix){break;}const atom=this.parseAtom(breakOnTokenText);if(!atom){break;}body.push(atom);}if(this.mode==="text"){this.formLigatures(body);}return this.handleInfixNodes(body);}/**
   * Rewrites infix operators such as \over with corresponding commands such
   * as \frac.
   *
   * There can only be one infix operator per group.  If there's more than one
   * then the expression is ambiguous.  This can be resolved by adding {}.
   */handleInfixNodes(body){let overIndex=-1;let funcName;for(let i=0;i<body.length;i++){const node=checkNodeType(body[i],"infix");if(node){if(overIndex!==-1){throw new ParseError("only one infix operator per group",node.token);}overIndex=i;funcName=node.replaceWith;}}if(overIndex!==-1&&funcName){let numerNode;let denomNode;const numerBody=body.slice(0,overIndex);const denomBody=body.slice(overIndex+1);if(numerBody.length===1&&numerBody[0].type==="ordgroup"){numerNode=numerBody[0];}else{numerNode={type:"ordgroup",mode:this.mode,body:numerBody};}if(denomBody.length===1&&denomBody[0].type==="ordgroup"){denomNode=denomBody[0];}else{denomNode={type:"ordgroup",mode:this.mode,body:denomBody};}let node;if(funcName==="\\\\abovefrac"){node=this.callFunction(funcName,[numerNode,body[overIndex],denomNode],[]);}else{node=this.callFunction(funcName,[numerNode,denomNode],[]);}return [node];}else{return body;}}// The greediness of a superscript or subscript
/**
   * Handle a subscript or superscript with nice errors.
   */handleSupSubscript(name){const symbolToken=this.nextToken;const symbol=symbolToken.text;this.consume();this.consumeSpaces();// ignore spaces before sup/subscript argument
const group=this.parseGroup(name,false,Parser.SUPSUB_GREEDINESS);if(!group){throw new ParseError("Expected group after '"+symbol+"'",symbolToken);}return group;}/**
   * Converts the textual input of an unsupported command into a text node
   * contained within a color node whose color is determined by errorColor
   */handleUnsupportedCmd(){const text=this.nextToken.text;const textordArray=[];for(let i=0;i<text.length;i++){textordArray.push({type:"textord",mode:"text",text:text[i]});}const textNode={type:"text",mode:this.mode,body:textordArray};const colorNode={type:"color",mode:this.mode,color:this.settings.errorColor,body:[textNode]};this.consume();return colorNode;}/**
   * Parses a group with optional super/subscripts.
   */parseAtom(breakOnTokenText){// The body of an atom is an implicit group, so that things like
// \left(x\right)^2 work correctly.
const base=this.parseGroup("atom",false,null,breakOnTokenText);// In text mode, we don't have superscripts or subscripts
if(this.mode==="text"){return base;}// Note that base may be empty (i.e. null) at this point.
let superscript;let subscript;while(true){// Guaranteed in math mode, so eat any spaces first.
this.consumeSpaces();// Lex the first token
const lex=this.nextToken;if(lex.text==="\\limits"||lex.text==="\\nolimits"){// We got a limit control
const opNode=checkNodeType(base,"op");if(opNode){const limits=lex.text==="\\limits";opNode.limits=limits;opNode.alwaysHandleSupSub=true;}else{throw new ParseError("Limit controls must follow a math operator",lex);}this.consume();}else if(lex.text==="^"){// We got a superscript start
if(superscript){throw new ParseError("Double superscript",lex);}superscript=this.handleSupSubscript("superscript");}else if(lex.text==="_"){// We got a subscript start
if(subscript){throw new ParseError("Double subscript",lex);}subscript=this.handleSupSubscript("subscript");}else if(lex.text==="'"){// We got a prime
if(superscript){throw new ParseError("Double superscript",lex);}const prime={type:"textord",mode:this.mode,text:"\\prime"};// Many primes can be grouped together, so we handle this here
const primes=[prime];this.consume();// Keep lexing tokens until we get something that's not a prime
while(this.nextToken.text==="'"){// For each one, add another prime to the list
primes.push(prime);this.consume();}// If there's a superscript following the primes, combine that
// superscript in with the primes.
if(this.nextToken.text==="^"){primes.push(this.handleSupSubscript("superscript"));}// Put everything into an ordgroup as the superscript
superscript={type:"ordgroup",mode:this.mode,body:primes};}else{// If it wasn't ^, _, or ', stop parsing super/subscripts
break;}}// Base must be set if superscript or subscript are set per logic above,
// but need to check here for type check to pass.
if(superscript||subscript){// If we got either a superscript or subscript, create a supsub
return {type:"supsub",mode:this.mode,base:base,sup:superscript,sub:subscript};}else{// Otherwise return the original body
return base;}}/**
   * Parses an entire function, including its base and all of its arguments.
   */parseFunction(breakOnTokenText,name,// For error reporting.
greediness){const token=this.nextToken;const func=token.text;const funcData=functions[func];if(!funcData){return null;}if(greediness!=null&&funcData.greediness<=greediness){throw new ParseError("Got function '"+func+"' with no arguments"+(name?" as "+name:""),token);}else if(this.mode==="text"&&!funcData.allowedInText){throw new ParseError("Can't use function '"+func+"' in text mode",token);}else if(this.mode==="math"&&funcData.allowedInMath===false){throw new ParseError("Can't use function '"+func+"' in math mode",token);}// hyperref package sets the catcode of % as an active character
if(funcData.argTypes&&funcData.argTypes[0]==="url"){this.gullet.lexer.setCatcode("%",13);}// Consume the command token after possibly switching to the
// mode specified by the function (for instant mode switching),
// and then immediately switch back.
if(funcData.consumeMode){const oldMode=this.mode;this.switchMode(funcData.consumeMode);this.consume();this.switchMode(oldMode);}else{this.consume();}const _this$parseArguments=this.parseArguments(func,funcData),args=_this$parseArguments.args,optArgs=_this$parseArguments.optArgs;return this.callFunction(func,args,optArgs,token,breakOnTokenText);}/**
   * Call a function handler with a suitable context and arguments.
   */callFunction(name,args,optArgs,token,breakOnTokenText){const context={funcName:name,parser:this,token,breakOnTokenText};const func=functions[name];if(func&&func.handler){return func.handler(context,args,optArgs);}else{throw new ParseError(`No function handler for ${name}`);}}/**
   * Parses the arguments of a function or environment
   */parseArguments(func,// Should look like "\name" or "\begin{name}".
funcData){const totalArgs=funcData.numArgs+funcData.numOptionalArgs;if(totalArgs===0){return {args:[],optArgs:[]};}const baseGreediness=funcData.greediness;const args=[];const optArgs=[];for(let i=0;i<totalArgs;i++){const argType=funcData.argTypes&&funcData.argTypes[i];const isOptional=i<funcData.numOptionalArgs;// Ignore spaces between arguments.  As the TeXbook says:
// "After you have said ‘\def\row#1#2{...}’, you are allowed to
//  put spaces between the arguments (e.g., ‘\row x n’), because
//  TeX doesn’t use single spaces as undelimited arguments."
if(i>0&&!isOptional){this.consumeSpaces();}// Also consume leading spaces in math mode, as parseSymbol
// won't know what to do with them.  This can only happen with
// macros, e.g. \frac\foo\foo where \foo expands to a space symbol.
// In LaTeX, the \foo's get treated as (blank) arguments).
// In KaTeX, for now, both spaces will get consumed.
// TODO(edemaine)
if(i===0&&!isOptional&&this.mode==="math"){this.consumeSpaces();}const nextToken=this.nextToken;const arg=this.parseGroupOfType("argument to '"+func+"'",argType,isOptional,baseGreediness);if(!arg){if(isOptional){optArgs.push(null);continue;}throw new ParseError("Expected group after '"+func+"'",nextToken);}(isOptional?optArgs:args).push(arg);}return {args,optArgs};}/**
   * Parses a group when the mode is changing.
   */parseGroupOfType(name,type,optional,greediness){switch(type){case"color":return this.parseColorGroup(optional);case"size":return this.parseSizeGroup(optional);case"url":return this.parseUrlGroup(optional);case"math":case"text":return this.parseGroup(name,optional,greediness,undefined,type);case"raw":{if(optional&&this.nextToken.text==="{"){return null;}const token=this.parseStringGroup("raw",optional,true);if(token){return {type:"raw",mode:"text",string:token.text};}else{throw new ParseError("Expected raw group",this.nextToken);}}case"original":case null:case undefined:return this.parseGroup(name,optional,greediness);default:throw new ParseError("Unknown group type as "+name,this.nextToken);}}consumeSpaces(){while(this.nextToken.text===" "){this.consume();}}/**
   * Parses a group, essentially returning the string formed by the
   * brace-enclosed tokens plus some position information.
   */parseStringGroup(modeName,// Used to describe the mode in error messages.
optional,raw){const groupBegin=optional?"[":"{";const groupEnd=optional?"]":"}";const nextToken=this.nextToken;if(nextToken.text!==groupBegin){if(optional){return null;}else if(raw&&nextToken.text!=="EOF"&&/[^{}[\]]/.test(nextToken.text)){// allow a single character in raw string group
this.gullet.lexer.setCatcode("%",14);// reset the catcode of %
this.consume();return nextToken;}}const outerMode=this.mode;this.mode="text";this.expect(groupBegin);let str="";const firstToken=this.nextToken;let nested=0;// allow nested braces in raw string group
let lastToken=firstToken;while(raw&&nested>0||this.nextToken.text!==groupEnd){switch(this.nextToken.text){case"EOF":throw new ParseError("Unexpected end of input in "+modeName,firstToken.range(lastToken,str));case groupBegin:nested++;break;case groupEnd:nested--;break;}lastToken=this.nextToken;str+=lastToken.text;this.consume();}this.mode=outerMode;this.gullet.lexer.setCatcode("%",14);// reset the catcode of %
this.expect(groupEnd);return firstToken.range(lastToken,str);}/**
   * Parses a regex-delimited group: the largest sequence of tokens
   * whose concatenated strings match `regex`. Returns the string
   * formed by the tokens plus some position information.
   */parseRegexGroup(regex,modeName){const outerMode=this.mode;this.mode="text";const firstToken=this.nextToken;let lastToken=firstToken;let str="";while(this.nextToken.text!=="EOF"&&regex.test(str+this.nextToken.text)){lastToken=this.nextToken;str+=lastToken.text;this.consume();}if(str===""){throw new ParseError("Invalid "+modeName+": '"+firstToken.text+"'",firstToken);}this.mode=outerMode;return firstToken.range(lastToken,str);}/**
   * Parses a color description.
   */parseColorGroup(optional){const res=this.parseStringGroup("color",optional);if(!res){return null;}const match=/^(#[a-f0-9]{3}|#?[a-f0-9]{6}|[a-z]+)$/i.exec(res.text);if(!match){throw new ParseError("Invalid color: '"+res.text+"'",res);}let color=match[0];if(/^[0-9a-f]{6}$/i.test(color)){// We allow a 6-digit HTML color spec without a leading "#".
// This follows the xcolor package's HTML color model.
// Predefined color names are all missed by this RegEx pattern.
color="#"+color;}return {type:"color-token",mode:this.mode,color};}/**
   * Parses a size specification, consisting of magnitude and unit.
   */parseSizeGroup(optional){let res;let isBlank=false;if(!optional&&this.nextToken.text!=="{"){res=this.parseRegexGroup(/^[-+]? *(?:$|\d+|\d+\.\d*|\.\d*) *[a-z]{0,2} *$/,"size");}else{res=this.parseStringGroup("size",optional);}if(!res){return null;}if(!optional&&res.text.length===0){// Because we've tested for what is !optional, this block won't
// affect \kern, \hspace, etc. It will capture the mandatory arguments
// to \genfrac and \above.
res.text="0pt";// Enable \above{}
isBlank=true;// This is here specifically for \genfrac
}const match=/([-+]?) *(\d+(?:\.\d*)?|\.\d+) *([a-z]{2})/.exec(res.text);if(!match){throw new ParseError("Invalid size: '"+res.text+"'",res);}const data={number:+(match[1]+match[2]),// sign + magnitude, cast to number
unit:match[3]};if(!validUnit(data)){throw new ParseError("Invalid unit: '"+data.unit+"'",res);}return {type:"size",mode:this.mode,value:data,isBlank};}/**
   * Parses an URL, checking escaped letters and allowed protocols.
   */parseUrlGroup(optional){const res=this.parseStringGroup("url",optional,true);// get raw string
if(!res){return null;}// hyperref package allows backslashes alone in href, but doesn't
// generate valid links in such cases; we interpret this as
// "undefined" behaviour, and keep them as-is. Some browser will
// replace backslashes with forward slashes.
const url=res.text.replace(/\\([#$%&~_^{}])/g,'$1');let protocol=/^\s*([^\\/#]*?)(?::|&#0*58|&#x0*3a)/i.exec(url);protocol=protocol!=null?protocol[1]:"_relative";const allowed=this.settings.allowedProtocols;if(!utils.contains(allowed,"*")&&!utils.contains(allowed,protocol)){throw new ParseError(`Forbidden protocol '${protocol}'`,res);}return {type:"url",mode:this.mode,url};}/**
   * If `optional` is false or absent, this parses an ordinary group,
   * which is either a single nucleus (like "x") or an expression
   * in braces (like "{x+y}") or an implicit group, a group that starts
   * at the current position, and ends right before a higher explicit
   * group ends, or at EOF.
   * If `optional` is true, it parses either a bracket-delimited expression
   * (like "[x+y]") or returns null to indicate the absence of a
   * bracket-enclosed group.
   * If `mode` is present, switches to that mode while parsing the group,
   * and switches back after.
   */parseGroup(name,// For error reporting.
optional,greediness,breakOnTokenText,mode){const outerMode=this.mode;const firstToken=this.nextToken;const text=firstToken.text;// Switch to specified mode
if(mode){this.switchMode(mode);}let groupEnd;let result;// Try to parse an open brace or \begingroup
if(optional?text==="[":text==="{"||text==="\\begingroup"){groupEnd=Parser.endOfGroup[text];// Start a new group namespace
this.gullet.beginGroup();// If we get a brace, parse an expression
this.consume();const expression=this.parseExpression(false,groupEnd);const lastToken=this.nextToken;// End group namespace before consuming symbol after close brace
this.gullet.endGroup();result={type:"ordgroup",mode:this.mode,loc:SourceLocation.range(firstToken,lastToken),body:expression,// A group formed by \begingroup...\endgroup is a semi-simple group
// which doesn't affect spacing in math mode, i.e., is transparent.
// https://tex.stackexchange.com/questions/1930/when-should-one-
// use-begingroup-instead-of-bgroup
semisimple:text==="\\begingroup"||undefined};}else if(optional){// Return nothing for an optional group
result=null;}else{// If there exists a function with this name, parse the function.
// Otherwise, just return a nucleus
result=this.parseFunction(breakOnTokenText,name,greediness)||this.parseSymbol();if(result==null&&text[0]==="\\"&&!implicitCommands.hasOwnProperty(text)){if(this.settings.throwOnError){throw new ParseError("Undefined control sequence: "+text,firstToken);}result=this.handleUnsupportedCmd();}}// Switch mode back
if(mode){this.switchMode(outerMode);}// Make sure we got a close brace
if(groupEnd){this.expect(groupEnd);}return result;}/**
   * Form ligature-like combinations of characters for text mode.
   * This includes inputs like "--", "---", "``" and "''".
   * The result will simply replace multiple textord nodes with a single
   * character in each value by a single textord node having multiple
   * characters in its value.  The representation is still ASCII source.
   * The group will be modified in place.
   */formLigatures(group){let n=group.length-1;for(let i=0;i<n;++i){const a=group[i];// $FlowFixMe: Not every node type has a `text` property.
const v=a.text;if(v==="-"&&group[i+1].text==="-"){if(i+1<n&&group[i+2].text==="-"){group.splice(i,3,{type:"textord",mode:"text",loc:SourceLocation.range(a,group[i+2]),text:"---"});n-=2;}else{group.splice(i,2,{type:"textord",mode:"text",loc:SourceLocation.range(a,group[i+1]),text:"--"});n-=1;}}if((v==="'"||v==="`")&&group[i+1].text===v){group.splice(i,2,{type:"textord",mode:"text",loc:SourceLocation.range(a,group[i+1]),text:v+v});n-=1;}}}/**
   * Parse a single symbol out of the string. Here, we handle single character
   * symbols and special functions like verbatim
   */parseSymbol(){const nucleus=this.nextToken;let text=nucleus.text;if(/^\\verb[^a-zA-Z]/.test(text)){this.consume();let arg=text.slice(5);const star=arg.charAt(0)==="*";if(star){arg=arg.slice(1);}// Lexer's tokenRegex is constructed to always have matching
// first/last characters.
if(arg.length<2||arg.charAt(0)!==arg.slice(-1)){throw new ParseError(`\\verb assertion failed --
                    please report what input caused this bug`);}arg=arg.slice(1,-1);// remove first and last char
return {type:"verb",mode:"text",body:arg,star};}// At this point, we should have a symbol, possibly with accents.
// First expand any accented base symbol according to unicodeSymbols.
if(unicodeSymbols.hasOwnProperty(text[0])&&!symbols[this.mode][text[0]]){// This behavior is not strict (XeTeX-compatible) in math mode.
if(this.settings.strict&&this.mode==="math"){this.settings.reportNonstrict("unicodeTextInMathMode",`Accented Unicode text character "${text[0]}" used in `+`math mode`,nucleus);}text=unicodeSymbols[text[0]]+text.substr(1);}// Strip off any combining characters
const match=combiningDiacriticalMarksEndRegex.exec(text);if(match){text=text.substring(0,match.index);if(text==='i'){text='\u0131';// dotless i, in math and text mode
}else if(text==='j'){text='\u0237';// dotless j, in math and text mode
}}// Recognize base symbol
let symbol;if(symbols[this.mode][text]){if(this.settings.strict&&this.mode==='math'&&extraLatin.indexOf(text)>=0){this.settings.reportNonstrict("unicodeTextInMathMode",`Latin-1/Unicode text character "${text[0]}" used in `+`math mode`,nucleus);}const group=symbols[this.mode][text].group;const loc=SourceLocation.range(nucleus);let s;if(ATOMS.hasOwnProperty(group)){// $FlowFixMe
const family=group;s={type:"atom",mode:this.mode,family,loc,text};}else{// $FlowFixMe
s={type:group,mode:this.mode,loc,text};}symbol=s;}else if(text.charCodeAt(0)>=0x80){// no symbol for e.g. ^
if(this.settings.strict){if(!supportedCodepoint(text.charCodeAt(0))){this.settings.reportNonstrict("unknownSymbol",`Unrecognized Unicode character "${text[0]}"`+` (${text.charCodeAt(0)})`,nucleus);}else if(this.mode==="math"){this.settings.reportNonstrict("unicodeTextInMathMode",`Unicode text character "${text[0]}" used in math mode`,nucleus);}}symbol={type:"textord",mode:this.mode,loc:SourceLocation.range(nucleus),text};}else{return null;// EOF, ^, _, {, }, etc.
}this.consume();// Transform combining characters into accents
if(match){for(let i=0;i<match[0].length;i++){const accent=match[0][i];if(!unicodeAccents[accent]){throw new ParseError(`Unknown accent ' ${accent}'`,nucleus);}const command=unicodeAccents[accent][this.mode];if(!command){throw new ParseError(`Accent ${accent} unsupported in ${this.mode} mode`,nucleus);}symbol={type:"accent",mode:this.mode,loc:SourceLocation.range(nucleus),label:command,isStretchy:false,isShifty:true,base:symbol};}}return symbol;}}Parser.endOfExpression=["}","\\endgroup","\\end","\\right","&"];Parser.endOfGroup={"[":"]","{":"}","\\begingroup":"\\endgroup"/**
   * Parses an "expression", which is a list of atoms.
   *
   * `breakOnInfix`: Should the parsing stop when we hit infix nodes? This
   *                 happens when functions have higher precendence han infix
   *                 nodes in implicit parses.
   *
   * `breakOnTokenText`: The text of the token that the expression should end
   *                     with, or `null` if something else should end the
   *                     expression.
   */};Parser.SUPSUB_GREEDINESS=1;/**
 * Provides a single function for parsing an expression using a Parser
 * TODO(emily): Remove this
 */ /**
 * Parses an expression using a Parser, then returns the parsed result.
 */const parseTree=function parseTree(toParse,settings){if(!(typeof toParse==='string'||toParse instanceof String)){throw new TypeError('KaTeX can only parse string typed expression');}const parser=new Parser(toParse,settings);// Blank out any \df@tag to avoid spurious "Duplicate \tag" errors
delete parser.gullet.macros.current["\\df@tag"];let tree=parser.parse();// If the input used \tag, it will set the \df@tag macro to the tag.
// In this case, we separately parse the tag and wrap the tree.
if(parser.gullet.macros.get("\\df@tag")){if(!settings.displayMode){throw new ParseError("\\tag works only in display equations");}parser.gullet.feed("\\df@tag");tree=[{type:"tag",mode:"text",body:tree,tag:parser.parse()}];}return tree;};/* eslint no-console:0 */ /**
 * Parse and build an expression, and place that expression in the DOM node
 * given.
 */let render=function render(expression,baseNode,options){baseNode.textContent="";const node=renderToDomTree(expression,options).toNode();baseNode.appendChild(node);};// KaTeX's styles don't work properly in quirks mode. Print out an error, and
// disable rendering.
if(typeof document!=="undefined"){if(document.compatMode!=="CSS1Compat"){typeof console!=="undefined"&&console.warn("Warning: KaTeX doesn't work in quirks mode. Make sure your "+"website has a suitable doctype.");render=function render(){throw new ParseError("KaTeX doesn't work in quirks mode.");};}}/**
 * Parse and build an expression, and return the markup for that.
 */const renderToString=function renderToString(expression,options){const markup=renderToDomTree(expression,options).toMarkup();return markup;};/**
 * Parse an expression and return the parse tree.
 */const generateParseTree=function generateParseTree(expression,options){const settings=new Settings(options);return parseTree(expression,settings);};/**
 * If the given error is a KaTeX ParseError and options.throwOnError is false,
 * renders the invalid LaTeX as a span with hover title giving the KaTeX
 * error message.  Otherwise, simply throws the error.
 */const renderError=function renderError(error,expression,options){if(options.throwOnError||!(error instanceof ParseError)){throw error;}const node=buildCommon.makeSpan(["katex-error"],[new SymbolNode(expression)]);node.setAttribute("title",error.toString());node.setAttribute("style",`color:${options.errorColor}`);return node;};/**
 * Generates and returns the katex build tree. This is used for advanced
 * use cases (like rendering to custom output).
 */const renderToDomTree=function renderToDomTree(expression,options){const settings=new Settings(options);try{const tree=parseTree(expression,settings);return buildTree(tree,expression,settings);}catch(error){return renderError(error,expression,settings);}};/**
 * Generates and returns the katex build tree, with just HTML (no MathML).
 * This is used for advanced use cases (like rendering to custom output).
 */const renderToHTMLTree=function renderToHTMLTree(expression,options){const settings=new Settings(options);try{const tree=parseTree(expression,settings);return buildHTMLTree(tree,expression,settings);}catch(error){return renderError(error,expression,settings);}};var katex={/**
   * Current KaTeX version
   */version:"0.10.1",/**
   * Renders the given LaTeX into an HTML+MathML combination, and adds
   * it as a child to the specified DOM node.
   */render,/**
   * Renders the given LaTeX into an HTML+MathML combination string,
   * for sending to the client.
   */renderToString,/**
   * KaTeX error, usually during parsing.
   */ParseError,/**
   * Parses the given LaTeX into KaTeX's internal parse tree structure,
   * without rendering to HTML or MathML.
   *
   * NOTE: This method is not currently recommended for public use.
   * The internal tree representation is unstable and is very likely
   * to change. Use at your own risk.
   */__parse:generateParseTree,/**
   * Renders the given LaTeX into an HTML+MathML internal DOM tree
   * representation, without flattening that representation to a string.
   *
   * NOTE: This method is not currently recommended for public use.
   * The internal tree representation is unstable and is very likely
   * to change. Use at your own risk.
   */__renderToDomTree:renderToDomTree,/**
   * Renders the given LaTeX into an HTML internal DOM tree representation,
   * without MathML and without flattening that representation to a string.
   *
   * NOTE: This method is not currently recommended for public use.
   * The internal tree representation is unstable and is very likely
   * to change. Use at your own risk.
   */__renderToHTMLTree:renderToHTMLTree,/**
   * extends internal font metrics object with a new object
   * each key in the new object represents a font name
  */__setFontMetrics:setFontMetrics,/**
   * adds a new symbol to builtin symbols table
   */__defineSymbol:defineSymbol,/**
   * adds a new macro to builtin macro list
   */__defineMacro:defineMacro,/**
   * Expose the dom tree node types, which can be useful for type checking nodes.
   *
   * NOTE: This method is not currently recommended for public use.
   * The internal tree representation is unstable and is very likely
   * to change. Use at your own risk.
   */__domTree:{Span,Anchor,SymbolNode,SvgNode,PathNode,LineNode}};

function _templateObject() {
  var data = _taggedTemplateLiteral(["", ""]);

  _templateObject = function _templateObject() {
    return data;
  };

  return data;
}

String.prototype.tex = function () {
  var laTexRegex = /\$\$(.*?)\$\$|\$(.*?)\$/g;
  var laTex = this.match(laTexRegex);

  if (laTex) {
    var tex = this;

    for (var i = 0; i < laTex.length; i++) {
      var laTexHtml = katex.renderToString(String.raw(_templateObject(), laTex[i].replace(/\$/g, "")), {
        throwOnError: false
      });
      tex = tex.replace(laTex[i], laTexHtml);
    }

    return tex;
  } else {
    return this;
  }
};
/**
 * build a color list
 * @param  {strin} specifier sring with hex colors without the # and space between them
 * @return {array}           an array of all the colors
 */


function colors(specifier) {
  var n = specifier.length / 6 | 0,
      colors = new Array(n),
      i = 0;

  while (i < n) {
    colors[i] = "#" + specifier.slice(i * 6, ++i * 6);
  }

  return colors;
}

var PI = 3.14;

function ascending(a, b) {
  return a < b ? -1 : a > b ? 1 : a >= b ? 0 : NaN;
}

function bisector(compare) {
  if (compare.length === 1) compare = ascendingComparator(compare);
  return {
    left: function(a, x, lo, hi) {
      if (lo == null) lo = 0;
      if (hi == null) hi = a.length;
      while (lo < hi) {
        var mid = lo + hi >>> 1;
        if (compare(a[mid], x) < 0) lo = mid + 1;
        else hi = mid;
      }
      return lo;
    },
    right: function(a, x, lo, hi) {
      if (lo == null) lo = 0;
      if (hi == null) hi = a.length;
      while (lo < hi) {
        var mid = lo + hi >>> 1;
        if (compare(a[mid], x) > 0) hi = mid;
        else lo = mid + 1;
      }
      return lo;
    }
  };
}

function ascendingComparator(f) {
  return function(d, x) {
    return ascending(f(d), x);
  };
}

var ascendingBisect = bisector(ascending);
var bisectRight = ascendingBisect.right;

var e10 = Math.sqrt(50),
    e5 = Math.sqrt(10),
    e2 = Math.sqrt(2);

function ticks(start, stop, count) {
  var reverse,
      i = -1,
      n,
      ticks,
      step;

  stop = +stop, start = +start, count = +count;
  if (start === stop && count > 0) return [start];
  if (reverse = stop < start) n = start, start = stop, stop = n;
  if ((step = tickIncrement(start, stop, count)) === 0 || !isFinite(step)) return [];

  if (step > 0) {
    start = Math.ceil(start / step);
    stop = Math.floor(stop / step);
    ticks = new Array(n = Math.ceil(stop - start + 1));
    while (++i < n) ticks[i] = (start + i) * step;
  } else {
    start = Math.floor(start * step);
    stop = Math.ceil(stop * step);
    ticks = new Array(n = Math.ceil(start - stop + 1));
    while (++i < n) ticks[i] = (start - i) / step;
  }

  if (reverse) ticks.reverse();

  return ticks;
}

function tickIncrement(start, stop, count) {
  var step = (stop - start) / Math.max(0, count),
      power = Math.floor(Math.log(step) / Math.LN10),
      error = step / Math.pow(10, power);
  return power >= 0
      ? (error >= e10 ? 10 : error >= e5 ? 5 : error >= e2 ? 2 : 1) * Math.pow(10, power)
      : -Math.pow(10, -power) / (error >= e10 ? 10 : error >= e5 ? 5 : error >= e2 ? 2 : 1);
}

function tickStep(start, stop, count) {
  var step0 = Math.abs(stop - start) / Math.max(0, count),
      step1 = Math.pow(10, Math.floor(Math.log(step0) / Math.LN10)),
      error = step0 / step1;
  if (error >= e10) step1 *= 10;
  else if (error >= e5) step1 *= 5;
  else if (error >= e2) step1 *= 2;
  return stop < start ? -step1 : step1;
}

function max(values, valueof) {
  var n = values.length,
      i = -1,
      value,
      max;

  if (valueof == null) {
    while (++i < n) { // Find the first comparable value.
      if ((value = values[i]) != null && value >= value) {
        max = value;
        while (++i < n) { // Compare the remaining values.
          if ((value = values[i]) != null && value > max) {
            max = value;
          }
        }
      }
    }
  }

  else {
    while (++i < n) { // Find the first comparable value.
      if ((value = valueof(values[i], i, values)) != null && value >= value) {
        max = value;
        while (++i < n) { // Compare the remaining values.
          if ((value = valueof(values[i], i, values)) != null && value > max) {
            max = value;
          }
        }
      }
    }
  }

  return max;
}

function min(values, valueof) {
  var n = values.length,
      i = -1,
      value,
      min;

  if (valueof == null) {
    while (++i < n) { // Find the first comparable value.
      if ((value = values[i]) != null && value >= value) {
        min = value;
        while (++i < n) { // Compare the remaining values.
          if ((value = values[i]) != null && min > value) {
            min = value;
          }
        }
      }
    }
  }

  else {
    while (++i < n) { // Find the first comparable value.
      if ((value = valueof(values[i], i, values)) != null && value >= value) {
        min = value;
        while (++i < n) { // Compare the remaining values.
          if ((value = valueof(values[i], i, values)) != null && min > value) {
            min = value;
          }
        }
      }
    }
  }

  return min;
}

var slice = Array.prototype.slice;

function identity(x) {
  return x;
}

var top = 1,
    right = 2,
    bottom = 3,
    left = 4,
    epsilon = 1e-6;

function translateX(x) {
  return "translate(" + (x + 0.5) + ",0)";
}

function translateY(y) {
  return "translate(0," + (y + 0.5) + ")";
}

function number(scale) {
  return function(d) {
    return +scale(d);
  };
}

function center(scale) {
  var offset = Math.max(0, scale.bandwidth() - 1) / 2; // Adjust for 0.5px offset.
  if (scale.round()) offset = Math.round(offset);
  return function(d) {
    return +scale(d) + offset;
  };
}

function entering() {
  return !this.__axis;
}

function axis(orient, scale) {
  var tickArguments = [],
      tickValues = null,
      tickFormat = null,
      tickSizeInner = 6,
      tickSizeOuter = 6,
      tickPadding = 3,
      k = orient === top || orient === left ? -1 : 1,
      x = orient === left || orient === right ? "x" : "y",
      transform = orient === top || orient === bottom ? translateX : translateY;

  function axis(context) {
    var values = tickValues == null ? (scale.ticks ? scale.ticks.apply(scale, tickArguments) : scale.domain()) : tickValues,
        format = tickFormat == null ? (scale.tickFormat ? scale.tickFormat.apply(scale, tickArguments) : identity) : tickFormat,
        spacing = Math.max(tickSizeInner, 0) + tickPadding,
        range = scale.range(),
        range0 = +range[0] + 0.5,
        range1 = +range[range.length - 1] + 0.5,
        position = (scale.bandwidth ? center : number)(scale.copy()),
        selection = context.selection ? context.selection() : context,
        path = selection.selectAll(".domain").data([null]),
        tick = selection.selectAll(".tick").data(values, scale).order(),
        tickExit = tick.exit(),
        tickEnter = tick.enter().append("g").attr("class", "tick"),
        line = tick.select("line"),
        text = tick.select("text");

    path = path.merge(path.enter().insert("path", ".tick")
        .attr("class", "domain")
        .attr("stroke", "currentColor"));

    tick = tick.merge(tickEnter);

    line = line.merge(tickEnter.append("line")
        .attr("stroke", "currentColor")
        .attr(x + "2", k * tickSizeInner));

    text = text.merge(tickEnter.append("text")
        .attr("fill", "currentColor")
        .attr(x, k * spacing)
        .attr("dy", orient === top ? "0em" : orient === bottom ? "0.71em" : "0.32em"));

    if (context !== selection) {
      path = path.transition(context);
      tick = tick.transition(context);
      line = line.transition(context);
      text = text.transition(context);

      tickExit = tickExit.transition(context)
          .attr("opacity", epsilon)
          .attr("transform", function(d) { return isFinite(d = position(d)) ? transform(d) : this.getAttribute("transform"); });

      tickEnter
          .attr("opacity", epsilon)
          .attr("transform", function(d) { var p = this.parentNode.__axis; return transform(p && isFinite(p = p(d)) ? p : position(d)); });
    }

    tickExit.remove();

    path
        .attr("d", orient === left || orient == right
            ? (tickSizeOuter ? "M" + k * tickSizeOuter + "," + range0 + "H0.5V" + range1 + "H" + k * tickSizeOuter : "M0.5," + range0 + "V" + range1)
            : (tickSizeOuter ? "M" + range0 + "," + k * tickSizeOuter + "V0.5H" + range1 + "V" + k * tickSizeOuter : "M" + range0 + ",0.5H" + range1));

    tick
        .attr("opacity", 1)
        .attr("transform", function(d) { return transform(position(d)); });

    line
        .attr(x + "2", k * tickSizeInner);

    text
        .attr(x, k * spacing)
        .text(format);

    selection.filter(entering)
        .attr("fill", "none")
        .attr("font-size", 10)
        .attr("font-family", "sans-serif")
        .attr("text-anchor", orient === right ? "start" : orient === left ? "end" : "middle");

    selection
        .each(function() { this.__axis = position; });
  }

  axis.scale = function(_) {
    return arguments.length ? (scale = _, axis) : scale;
  };

  axis.ticks = function() {
    return tickArguments = slice.call(arguments), axis;
  };

  axis.tickArguments = function(_) {
    return arguments.length ? (tickArguments = _ == null ? [] : slice.call(_), axis) : tickArguments.slice();
  };

  axis.tickValues = function(_) {
    return arguments.length ? (tickValues = _ == null ? null : slice.call(_), axis) : tickValues && tickValues.slice();
  };

  axis.tickFormat = function(_) {
    return arguments.length ? (tickFormat = _, axis) : tickFormat;
  };

  axis.tickSize = function(_) {
    return arguments.length ? (tickSizeInner = tickSizeOuter = +_, axis) : tickSizeInner;
  };

  axis.tickSizeInner = function(_) {
    return arguments.length ? (tickSizeInner = +_, axis) : tickSizeInner;
  };

  axis.tickSizeOuter = function(_) {
    return arguments.length ? (tickSizeOuter = +_, axis) : tickSizeOuter;
  };

  axis.tickPadding = function(_) {
    return arguments.length ? (tickPadding = +_, axis) : tickPadding;
  };

  return axis;
}

function axisTop(scale) {
  return axis(top, scale);
}

function axisRight(scale) {
  return axis(right, scale);
}

function axisBottom(scale) {
  return axis(bottom, scale);
}

function axisLeft(scale) {
  return axis(left, scale);
}

var noop = {value: function() {}};

function dispatch() {
  for (var i = 0, n = arguments.length, _ = {}, t; i < n; ++i) {
    if (!(t = arguments[i] + "") || (t in _)) throw new Error("illegal type: " + t);
    _[t] = [];
  }
  return new Dispatch(_);
}

function Dispatch(_) {
  this._ = _;
}

function parseTypenames(typenames, types) {
  return typenames.trim().split(/^|\s+/).map(function(t) {
    var name = "", i = t.indexOf(".");
    if (i >= 0) name = t.slice(i + 1), t = t.slice(0, i);
    if (t && !types.hasOwnProperty(t)) throw new Error("unknown type: " + t);
    return {type: t, name: name};
  });
}

Dispatch.prototype = dispatch.prototype = {
  constructor: Dispatch,
  on: function(typename, callback) {
    var _ = this._,
        T = parseTypenames(typename + "", _),
        t,
        i = -1,
        n = T.length;

    // If no callback was specified, return the callback of the given type and name.
    if (arguments.length < 2) {
      while (++i < n) if ((t = (typename = T[i]).type) && (t = get(_[t], typename.name))) return t;
      return;
    }

    // If a type was specified, set the callback for the given type and name.
    // Otherwise, if a null callback was specified, remove callbacks of the given name.
    if (callback != null && typeof callback !== "function") throw new Error("invalid callback: " + callback);
    while (++i < n) {
      if (t = (typename = T[i]).type) _[t] = set(_[t], typename.name, callback);
      else if (callback == null) for (t in _) _[t] = set(_[t], typename.name, null);
    }

    return this;
  },
  copy: function() {
    var copy = {}, _ = this._;
    for (var t in _) copy[t] = _[t].slice();
    return new Dispatch(copy);
  },
  call: function(type, that) {
    if ((n = arguments.length - 2) > 0) for (var args = new Array(n), i = 0, n, t; i < n; ++i) args[i] = arguments[i + 2];
    if (!this._.hasOwnProperty(type)) throw new Error("unknown type: " + type);
    for (t = this._[type], i = 0, n = t.length; i < n; ++i) t[i].value.apply(that, args);
  },
  apply: function(type, that, args) {
    if (!this._.hasOwnProperty(type)) throw new Error("unknown type: " + type);
    for (var t = this._[type], i = 0, n = t.length; i < n; ++i) t[i].value.apply(that, args);
  }
};

function get(type, name) {
  for (var i = 0, n = type.length, c; i < n; ++i) {
    if ((c = type[i]).name === name) {
      return c.value;
    }
  }
}

function set(type, name, callback) {
  for (var i = 0, n = type.length; i < n; ++i) {
    if (type[i].name === name) {
      type[i] = noop, type = type.slice(0, i).concat(type.slice(i + 1));
      break;
    }
  }
  if (callback != null) type.push({name: name, value: callback});
  return type;
}

var xhtml = "http://www.w3.org/1999/xhtml";

var namespaces = {
  svg: "http://www.w3.org/2000/svg",
  xhtml: xhtml,
  xlink: "http://www.w3.org/1999/xlink",
  xml: "http://www.w3.org/XML/1998/namespace",
  xmlns: "http://www.w3.org/2000/xmlns/"
};

function namespace(name) {
  var prefix = name += "", i = prefix.indexOf(":");
  if (i >= 0 && (prefix = name.slice(0, i)) !== "xmlns") name = name.slice(i + 1);
  return namespaces.hasOwnProperty(prefix) ? {space: namespaces[prefix], local: name} : name;
}

function creatorInherit(name) {
  return function() {
    var document = this.ownerDocument,
        uri = this.namespaceURI;
    return uri === xhtml && document.documentElement.namespaceURI === xhtml
        ? document.createElement(name)
        : document.createElementNS(uri, name);
  };
}

function creatorFixed(fullname) {
  return function() {
    return this.ownerDocument.createElementNS(fullname.space, fullname.local);
  };
}

function creator(name) {
  var fullname = namespace(name);
  return (fullname.local
      ? creatorFixed
      : creatorInherit)(fullname);
}

function none() {}

function selector(selector) {
  return selector == null ? none : function() {
    return this.querySelector(selector);
  };
}

function selection_select(select) {
  if (typeof select !== "function") select = selector(select);

  for (var groups = this._groups, m = groups.length, subgroups = new Array(m), j = 0; j < m; ++j) {
    for (var group = groups[j], n = group.length, subgroup = subgroups[j] = new Array(n), node, subnode, i = 0; i < n; ++i) {
      if ((node = group[i]) && (subnode = select.call(node, node.__data__, i, group))) {
        if ("__data__" in node) subnode.__data__ = node.__data__;
        subgroup[i] = subnode;
      }
    }
  }

  return new Selection(subgroups, this._parents);
}

function empty() {
  return [];
}

function selectorAll(selector) {
  return selector == null ? empty : function() {
    return this.querySelectorAll(selector);
  };
}

function selection_selectAll(select) {
  if (typeof select !== "function") select = selectorAll(select);

  for (var groups = this._groups, m = groups.length, subgroups = [], parents = [], j = 0; j < m; ++j) {
    for (var group = groups[j], n = group.length, node, i = 0; i < n; ++i) {
      if (node = group[i]) {
        subgroups.push(select.call(node, node.__data__, i, group));
        parents.push(node);
      }
    }
  }

  return new Selection(subgroups, parents);
}

function matcher(selector) {
  return function() {
    return this.matches(selector);
  };
}

function selection_filter(match) {
  if (typeof match !== "function") match = matcher(match);

  for (var groups = this._groups, m = groups.length, subgroups = new Array(m), j = 0; j < m; ++j) {
    for (var group = groups[j], n = group.length, subgroup = subgroups[j] = [], node, i = 0; i < n; ++i) {
      if ((node = group[i]) && match.call(node, node.__data__, i, group)) {
        subgroup.push(node);
      }
    }
  }

  return new Selection(subgroups, this._parents);
}

function sparse(update) {
  return new Array(update.length);
}

function selection_enter() {
  return new Selection(this._enter || this._groups.map(sparse), this._parents);
}

function EnterNode(parent, datum) {
  this.ownerDocument = parent.ownerDocument;
  this.namespaceURI = parent.namespaceURI;
  this._next = null;
  this._parent = parent;
  this.__data__ = datum;
}

EnterNode.prototype = {
  constructor: EnterNode,
  appendChild: function(child) { return this._parent.insertBefore(child, this._next); },
  insertBefore: function(child, next) { return this._parent.insertBefore(child, next); },
  querySelector: function(selector) { return this._parent.querySelector(selector); },
  querySelectorAll: function(selector) { return this._parent.querySelectorAll(selector); }
};

function constant(x) {
  return function() {
    return x;
  };
}

var keyPrefix = "$"; // Protect against keys like “__proto__”.

function bindIndex(parent, group, enter, update, exit, data) {
  var i = 0,
      node,
      groupLength = group.length,
      dataLength = data.length;

  // Put any non-null nodes that fit into update.
  // Put any null nodes into enter.
  // Put any remaining data into enter.
  for (; i < dataLength; ++i) {
    if (node = group[i]) {
      node.__data__ = data[i];
      update[i] = node;
    } else {
      enter[i] = new EnterNode(parent, data[i]);
    }
  }

  // Put any non-null nodes that don’t fit into exit.
  for (; i < groupLength; ++i) {
    if (node = group[i]) {
      exit[i] = node;
    }
  }
}

function bindKey(parent, group, enter, update, exit, data, key) {
  var i,
      node,
      nodeByKeyValue = {},
      groupLength = group.length,
      dataLength = data.length,
      keyValues = new Array(groupLength),
      keyValue;

  // Compute the key for each node.
  // If multiple nodes have the same key, the duplicates are added to exit.
  for (i = 0; i < groupLength; ++i) {
    if (node = group[i]) {
      keyValues[i] = keyValue = keyPrefix + key.call(node, node.__data__, i, group);
      if (keyValue in nodeByKeyValue) {
        exit[i] = node;
      } else {
        nodeByKeyValue[keyValue] = node;
      }
    }
  }

  // Compute the key for each datum.
  // If there a node associated with this key, join and add it to update.
  // If there is not (or the key is a duplicate), add it to enter.
  for (i = 0; i < dataLength; ++i) {
    keyValue = keyPrefix + key.call(parent, data[i], i, data);
    if (node = nodeByKeyValue[keyValue]) {
      update[i] = node;
      node.__data__ = data[i];
      nodeByKeyValue[keyValue] = null;
    } else {
      enter[i] = new EnterNode(parent, data[i]);
    }
  }

  // Add any remaining nodes that were not bound to data to exit.
  for (i = 0; i < groupLength; ++i) {
    if ((node = group[i]) && (nodeByKeyValue[keyValues[i]] === node)) {
      exit[i] = node;
    }
  }
}

function selection_data(value, key) {
  if (!value) {
    data = new Array(this.size()), j = -1;
    this.each(function(d) { data[++j] = d; });
    return data;
  }

  var bind = key ? bindKey : bindIndex,
      parents = this._parents,
      groups = this._groups;

  if (typeof value !== "function") value = constant(value);

  for (var m = groups.length, update = new Array(m), enter = new Array(m), exit = new Array(m), j = 0; j < m; ++j) {
    var parent = parents[j],
        group = groups[j],
        groupLength = group.length,
        data = value.call(parent, parent && parent.__data__, j, parents),
        dataLength = data.length,
        enterGroup = enter[j] = new Array(dataLength),
        updateGroup = update[j] = new Array(dataLength),
        exitGroup = exit[j] = new Array(groupLength);

    bind(parent, group, enterGroup, updateGroup, exitGroup, data, key);

    // Now connect the enter nodes to their following update node, such that
    // appendChild can insert the materialized enter node before this node,
    // rather than at the end of the parent node.
    for (var i0 = 0, i1 = 0, previous, next; i0 < dataLength; ++i0) {
      if (previous = enterGroup[i0]) {
        if (i0 >= i1) i1 = i0 + 1;
        while (!(next = updateGroup[i1]) && ++i1 < dataLength);
        previous._next = next || null;
      }
    }
  }

  update = new Selection(update, parents);
  update._enter = enter;
  update._exit = exit;
  return update;
}

function selection_exit() {
  return new Selection(this._exit || this._groups.map(sparse), this._parents);
}

function selection_join(onenter, onupdate, onexit) {
  var enter = this.enter(), update = this, exit = this.exit();
  enter = typeof onenter === "function" ? onenter(enter) : enter.append(onenter + "");
  if (onupdate != null) update = onupdate(update);
  if (onexit == null) exit.remove(); else onexit(exit);
  return enter && update ? enter.merge(update).order() : update;
}

function selection_merge(selection) {

  for (var groups0 = this._groups, groups1 = selection._groups, m0 = groups0.length, m1 = groups1.length, m = Math.min(m0, m1), merges = new Array(m0), j = 0; j < m; ++j) {
    for (var group0 = groups0[j], group1 = groups1[j], n = group0.length, merge = merges[j] = new Array(n), node, i = 0; i < n; ++i) {
      if (node = group0[i] || group1[i]) {
        merge[i] = node;
      }
    }
  }

  for (; j < m0; ++j) {
    merges[j] = groups0[j];
  }

  return new Selection(merges, this._parents);
}

function selection_order() {

  for (var groups = this._groups, j = -1, m = groups.length; ++j < m;) {
    for (var group = groups[j], i = group.length - 1, next = group[i], node; --i >= 0;) {
      if (node = group[i]) {
        if (next && node.compareDocumentPosition(next) ^ 4) next.parentNode.insertBefore(node, next);
        next = node;
      }
    }
  }

  return this;
}

function selection_sort(compare) {
  if (!compare) compare = ascending$1;

  function compareNode(a, b) {
    return a && b ? compare(a.__data__, b.__data__) : !a - !b;
  }

  for (var groups = this._groups, m = groups.length, sortgroups = new Array(m), j = 0; j < m; ++j) {
    for (var group = groups[j], n = group.length, sortgroup = sortgroups[j] = new Array(n), node, i = 0; i < n; ++i) {
      if (node = group[i]) {
        sortgroup[i] = node;
      }
    }
    sortgroup.sort(compareNode);
  }

  return new Selection(sortgroups, this._parents).order();
}

function ascending$1(a, b) {
  return a < b ? -1 : a > b ? 1 : a >= b ? 0 : NaN;
}

function selection_call() {
  var callback = arguments[0];
  arguments[0] = this;
  callback.apply(null, arguments);
  return this;
}

function selection_nodes() {
  var nodes = new Array(this.size()), i = -1;
  this.each(function() { nodes[++i] = this; });
  return nodes;
}

function selection_node() {

  for (var groups = this._groups, j = 0, m = groups.length; j < m; ++j) {
    for (var group = groups[j], i = 0, n = group.length; i < n; ++i) {
      var node = group[i];
      if (node) return node;
    }
  }

  return null;
}

function selection_size() {
  var size = 0;
  this.each(function() { ++size; });
  return size;
}

function selection_empty() {
  return !this.node();
}

function selection_each(callback) {

  for (var groups = this._groups, j = 0, m = groups.length; j < m; ++j) {
    for (var group = groups[j], i = 0, n = group.length, node; i < n; ++i) {
      if (node = group[i]) callback.call(node, node.__data__, i, group);
    }
  }

  return this;
}

function attrRemove(name) {
  return function() {
    this.removeAttribute(name);
  };
}

function attrRemoveNS(fullname) {
  return function() {
    this.removeAttributeNS(fullname.space, fullname.local);
  };
}

function attrConstant(name, value) {
  return function() {
    this.setAttribute(name, value);
  };
}

function attrConstantNS(fullname, value) {
  return function() {
    this.setAttributeNS(fullname.space, fullname.local, value);
  };
}

function attrFunction(name, value) {
  return function() {
    var v = value.apply(this, arguments);
    if (v == null) this.removeAttribute(name);
    else this.setAttribute(name, v);
  };
}

function attrFunctionNS(fullname, value) {
  return function() {
    var v = value.apply(this, arguments);
    if (v == null) this.removeAttributeNS(fullname.space, fullname.local);
    else this.setAttributeNS(fullname.space, fullname.local, v);
  };
}

function selection_attr(name, value) {
  var fullname = namespace(name);

  if (arguments.length < 2) {
    var node = this.node();
    return fullname.local
        ? node.getAttributeNS(fullname.space, fullname.local)
        : node.getAttribute(fullname);
  }

  return this.each((value == null
      ? (fullname.local ? attrRemoveNS : attrRemove) : (typeof value === "function"
      ? (fullname.local ? attrFunctionNS : attrFunction)
      : (fullname.local ? attrConstantNS : attrConstant)))(fullname, value));
}

function defaultView(node) {
  return (node.ownerDocument && node.ownerDocument.defaultView) // node is a Node
      || (node.document && node) // node is a Window
      || node.defaultView; // node is a Document
}

function styleRemove(name) {
  return function() {
    this.style.removeProperty(name);
  };
}

function styleConstant(name, value, priority) {
  return function() {
    this.style.setProperty(name, value, priority);
  };
}

function styleFunction(name, value, priority) {
  return function() {
    var v = value.apply(this, arguments);
    if (v == null) this.style.removeProperty(name);
    else this.style.setProperty(name, v, priority);
  };
}

function selection_style(name, value, priority) {
  return arguments.length > 1
      ? this.each((value == null
            ? styleRemove : typeof value === "function"
            ? styleFunction
            : styleConstant)(name, value, priority == null ? "" : priority))
      : styleValue(this.node(), name);
}

function styleValue(node, name) {
  return node.style.getPropertyValue(name)
      || defaultView(node).getComputedStyle(node, null).getPropertyValue(name);
}

function propertyRemove(name) {
  return function() {
    delete this[name];
  };
}

function propertyConstant(name, value) {
  return function() {
    this[name] = value;
  };
}

function propertyFunction(name, value) {
  return function() {
    var v = value.apply(this, arguments);
    if (v == null) delete this[name];
    else this[name] = v;
  };
}

function selection_property(name, value) {
  return arguments.length > 1
      ? this.each((value == null
          ? propertyRemove : typeof value === "function"
          ? propertyFunction
          : propertyConstant)(name, value))
      : this.node()[name];
}

function classArray(string) {
  return string.trim().split(/^|\s+/);
}

function classList(node) {
  return node.classList || new ClassList(node);
}

function ClassList(node) {
  this._node = node;
  this._names = classArray(node.getAttribute("class") || "");
}

ClassList.prototype = {
  add: function(name) {
    var i = this._names.indexOf(name);
    if (i < 0) {
      this._names.push(name);
      this._node.setAttribute("class", this._names.join(" "));
    }
  },
  remove: function(name) {
    var i = this._names.indexOf(name);
    if (i >= 0) {
      this._names.splice(i, 1);
      this._node.setAttribute("class", this._names.join(" "));
    }
  },
  contains: function(name) {
    return this._names.indexOf(name) >= 0;
  }
};

function classedAdd(node, names) {
  var list = classList(node), i = -1, n = names.length;
  while (++i < n) list.add(names[i]);
}

function classedRemove(node, names) {
  var list = classList(node), i = -1, n = names.length;
  while (++i < n) list.remove(names[i]);
}

function classedTrue(names) {
  return function() {
    classedAdd(this, names);
  };
}

function classedFalse(names) {
  return function() {
    classedRemove(this, names);
  };
}

function classedFunction(names, value) {
  return function() {
    (value.apply(this, arguments) ? classedAdd : classedRemove)(this, names);
  };
}

function selection_classed(name, value) {
  var names = classArray(name + "");

  if (arguments.length < 2) {
    var list = classList(this.node()), i = -1, n = names.length;
    while (++i < n) if (!list.contains(names[i])) return false;
    return true;
  }

  return this.each((typeof value === "function"
      ? classedFunction : value
      ? classedTrue
      : classedFalse)(names, value));
}

function textRemove() {
  this.textContent = "";
}

function textConstant(value) {
  return function() {
    this.textContent = value;
  };
}

function textFunction(value) {
  return function() {
    var v = value.apply(this, arguments);
    this.textContent = v == null ? "" : v;
  };
}

function selection_text(value) {
  return arguments.length
      ? this.each(value == null
          ? textRemove : (typeof value === "function"
          ? textFunction
          : textConstant)(value))
      : this.node().textContent;
}

function htmlRemove() {
  this.innerHTML = "";
}

function htmlConstant(value) {
  return function() {
    this.innerHTML = value;
  };
}

function htmlFunction(value) {
  return function() {
    var v = value.apply(this, arguments);
    this.innerHTML = v == null ? "" : v;
  };
}

function selection_html(value) {
  return arguments.length
      ? this.each(value == null
          ? htmlRemove : (typeof value === "function"
          ? htmlFunction
          : htmlConstant)(value))
      : this.node().innerHTML;
}

function raise() {
  if (this.nextSibling) this.parentNode.appendChild(this);
}

function selection_raise() {
  return this.each(raise);
}

function lower() {
  if (this.previousSibling) this.parentNode.insertBefore(this, this.parentNode.firstChild);
}

function selection_lower() {
  return this.each(lower);
}

function selection_append(name) {
  var create = typeof name === "function" ? name : creator(name);
  return this.select(function() {
    return this.appendChild(create.apply(this, arguments));
  });
}

function constantNull() {
  return null;
}

function selection_insert(name, before) {
  var create = typeof name === "function" ? name : creator(name),
      select = before == null ? constantNull : typeof before === "function" ? before : selector(before);
  return this.select(function() {
    return this.insertBefore(create.apply(this, arguments), select.apply(this, arguments) || null);
  });
}

function remove() {
  var parent = this.parentNode;
  if (parent) parent.removeChild(this);
}

function selection_remove() {
  return this.each(remove);
}

function selection_cloneShallow() {
  return this.parentNode.insertBefore(this.cloneNode(false), this.nextSibling);
}

function selection_cloneDeep() {
  return this.parentNode.insertBefore(this.cloneNode(true), this.nextSibling);
}

function selection_clone(deep) {
  return this.select(deep ? selection_cloneDeep : selection_cloneShallow);
}

function selection_datum(value) {
  return arguments.length
      ? this.property("__data__", value)
      : this.node().__data__;
}

var filterEvents = {};

if (typeof document !== "undefined") {
  var element = document.documentElement;
  if (!("onmouseenter" in element)) {
    filterEvents = {mouseenter: "mouseover", mouseleave: "mouseout"};
  }
}

function filterContextListener(listener, index, group) {
  listener = contextListener(listener, index, group);
  return function(event) {
    var related = event.relatedTarget;
    if (!related || (related !== this && !(related.compareDocumentPosition(this) & 8))) {
      listener.call(this, event);
    }
  };
}

function contextListener(listener, index, group) {
  return function(event1) {
    try {
      listener.call(this, this.__data__, index, group);
    } finally {
    }
  };
}

function parseTypenames$1(typenames) {
  return typenames.trim().split(/^|\s+/).map(function(t) {
    var name = "", i = t.indexOf(".");
    if (i >= 0) name = t.slice(i + 1), t = t.slice(0, i);
    return {type: t, name: name};
  });
}

function onRemove(typename) {
  return function() {
    var on = this.__on;
    if (!on) return;
    for (var j = 0, i = -1, m = on.length, o; j < m; ++j) {
      if (o = on[j], (!typename.type || o.type === typename.type) && o.name === typename.name) {
        this.removeEventListener(o.type, o.listener, o.capture);
      } else {
        on[++i] = o;
      }
    }
    if (++i) on.length = i;
    else delete this.__on;
  };
}

function onAdd(typename, value, capture) {
  var wrap = filterEvents.hasOwnProperty(typename.type) ? filterContextListener : contextListener;
  return function(d, i, group) {
    var on = this.__on, o, listener = wrap(value, i, group);
    if (on) for (var j = 0, m = on.length; j < m; ++j) {
      if ((o = on[j]).type === typename.type && o.name === typename.name) {
        this.removeEventListener(o.type, o.listener, o.capture);
        this.addEventListener(o.type, o.listener = listener, o.capture = capture);
        o.value = value;
        return;
      }
    }
    this.addEventListener(typename.type, listener, capture);
    o = {type: typename.type, name: typename.name, value: value, listener: listener, capture: capture};
    if (!on) this.__on = [o];
    else on.push(o);
  };
}

function selection_on(typename, value, capture) {
  var typenames = parseTypenames$1(typename + ""), i, n = typenames.length, t;

  if (arguments.length < 2) {
    var on = this.node().__on;
    if (on) for (var j = 0, m = on.length, o; j < m; ++j) {
      for (i = 0, o = on[j]; i < n; ++i) {
        if ((t = typenames[i]).type === o.type && t.name === o.name) {
          return o.value;
        }
      }
    }
    return;
  }

  on = value ? onAdd : onRemove;
  if (capture == null) capture = false;
  for (i = 0; i < n; ++i) this.each(on(typenames[i], value, capture));
  return this;
}

function dispatchEvent(node, type, params) {
  var window = defaultView(node),
      event = window.CustomEvent;

  if (typeof event === "function") {
    event = new event(type, params);
  } else {
    event = window.document.createEvent("Event");
    if (params) event.initEvent(type, params.bubbles, params.cancelable), event.detail = params.detail;
    else event.initEvent(type, false, false);
  }

  node.dispatchEvent(event);
}

function dispatchConstant(type, params) {
  return function() {
    return dispatchEvent(this, type, params);
  };
}

function dispatchFunction(type, params) {
  return function() {
    return dispatchEvent(this, type, params.apply(this, arguments));
  };
}

function selection_dispatch(type, params) {
  return this.each((typeof params === "function"
      ? dispatchFunction
      : dispatchConstant)(type, params));
}

var root = [null];

function Selection(groups, parents) {
  this._groups = groups;
  this._parents = parents;
}

function selection() {
  return new Selection([[document.documentElement]], root);
}

Selection.prototype = selection.prototype = {
  constructor: Selection,
  select: selection_select,
  selectAll: selection_selectAll,
  filter: selection_filter,
  data: selection_data,
  enter: selection_enter,
  exit: selection_exit,
  join: selection_join,
  merge: selection_merge,
  order: selection_order,
  sort: selection_sort,
  call: selection_call,
  nodes: selection_nodes,
  node: selection_node,
  size: selection_size,
  empty: selection_empty,
  each: selection_each,
  attr: selection_attr,
  style: selection_style,
  property: selection_property,
  classed: selection_classed,
  text: selection_text,
  html: selection_html,
  raise: selection_raise,
  lower: selection_lower,
  append: selection_append,
  insert: selection_insert,
  remove: selection_remove,
  clone: selection_clone,
  datum: selection_datum,
  on: selection_on,
  dispatch: selection_dispatch
};

function select(selector) {
  return typeof selector === "string"
      ? new Selection([[document.querySelector(selector)]], [document.documentElement])
      : new Selection([[selector]], root);
}

function define(constructor, factory, prototype) {
  constructor.prototype = factory.prototype = prototype;
  prototype.constructor = constructor;
}

function extend(parent, definition) {
  var prototype = Object.create(parent.prototype);
  for (var key in definition) prototype[key] = definition[key];
  return prototype;
}

function Color() {}

var darker = 0.7;
var brighter = 1 / darker;

var reI = "\\s*([+-]?\\d+)\\s*",
    reN = "\\s*([+-]?\\d*\\.?\\d+(?:[eE][+-]?\\d+)?)\\s*",
    reP = "\\s*([+-]?\\d*\\.?\\d+(?:[eE][+-]?\\d+)?)%\\s*",
    reHex3 = /^#([0-9a-f]{3})$/,
    reHex6 = /^#([0-9a-f]{6})$/,
    reRgbInteger = new RegExp("^rgb\\(" + [reI, reI, reI] + "\\)$"),
    reRgbPercent = new RegExp("^rgb\\(" + [reP, reP, reP] + "\\)$"),
    reRgbaInteger = new RegExp("^rgba\\(" + [reI, reI, reI, reN] + "\\)$"),
    reRgbaPercent = new RegExp("^rgba\\(" + [reP, reP, reP, reN] + "\\)$"),
    reHslPercent = new RegExp("^hsl\\(" + [reN, reP, reP] + "\\)$"),
    reHslaPercent = new RegExp("^hsla\\(" + [reN, reP, reP, reN] + "\\)$");

var named = {
  aliceblue: 0xf0f8ff,
  antiquewhite: 0xfaebd7,
  aqua: 0x00ffff,
  aquamarine: 0x7fffd4,
  azure: 0xf0ffff,
  beige: 0xf5f5dc,
  bisque: 0xffe4c4,
  black: 0x000000,
  blanchedalmond: 0xffebcd,
  blue: 0x0000ff,
  blueviolet: 0x8a2be2,
  brown: 0xa52a2a,
  burlywood: 0xdeb887,
  cadetblue: 0x5f9ea0,
  chartreuse: 0x7fff00,
  chocolate: 0xd2691e,
  coral: 0xff7f50,
  cornflowerblue: 0x6495ed,
  cornsilk: 0xfff8dc,
  crimson: 0xdc143c,
  cyan: 0x00ffff,
  darkblue: 0x00008b,
  darkcyan: 0x008b8b,
  darkgoldenrod: 0xb8860b,
  darkgray: 0xa9a9a9,
  darkgreen: 0x006400,
  darkgrey: 0xa9a9a9,
  darkkhaki: 0xbdb76b,
  darkmagenta: 0x8b008b,
  darkolivegreen: 0x556b2f,
  darkorange: 0xff8c00,
  darkorchid: 0x9932cc,
  darkred: 0x8b0000,
  darksalmon: 0xe9967a,
  darkseagreen: 0x8fbc8f,
  darkslateblue: 0x483d8b,
  darkslategray: 0x2f4f4f,
  darkslategrey: 0x2f4f4f,
  darkturquoise: 0x00ced1,
  darkviolet: 0x9400d3,
  deeppink: 0xff1493,
  deepskyblue: 0x00bfff,
  dimgray: 0x696969,
  dimgrey: 0x696969,
  dodgerblue: 0x1e90ff,
  firebrick: 0xb22222,
  floralwhite: 0xfffaf0,
  forestgreen: 0x228b22,
  fuchsia: 0xff00ff,
  gainsboro: 0xdcdcdc,
  ghostwhite: 0xf8f8ff,
  gold: 0xffd700,
  goldenrod: 0xdaa520,
  gray: 0x808080,
  green: 0x008000,
  greenyellow: 0xadff2f,
  grey: 0x808080,
  honeydew: 0xf0fff0,
  hotpink: 0xff69b4,
  indianred: 0xcd5c5c,
  indigo: 0x4b0082,
  ivory: 0xfffff0,
  khaki: 0xf0e68c,
  lavender: 0xe6e6fa,
  lavenderblush: 0xfff0f5,
  lawngreen: 0x7cfc00,
  lemonchiffon: 0xfffacd,
  lightblue: 0xadd8e6,
  lightcoral: 0xf08080,
  lightcyan: 0xe0ffff,
  lightgoldenrodyellow: 0xfafad2,
  lightgray: 0xd3d3d3,
  lightgreen: 0x90ee90,
  lightgrey: 0xd3d3d3,
  lightpink: 0xffb6c1,
  lightsalmon: 0xffa07a,
  lightseagreen: 0x20b2aa,
  lightskyblue: 0x87cefa,
  lightslategray: 0x778899,
  lightslategrey: 0x778899,
  lightsteelblue: 0xb0c4de,
  lightyellow: 0xffffe0,
  lime: 0x00ff00,
  limegreen: 0x32cd32,
  linen: 0xfaf0e6,
  magenta: 0xff00ff,
  maroon: 0x800000,
  mediumaquamarine: 0x66cdaa,
  mediumblue: 0x0000cd,
  mediumorchid: 0xba55d3,
  mediumpurple: 0x9370db,
  mediumseagreen: 0x3cb371,
  mediumslateblue: 0x7b68ee,
  mediumspringgreen: 0x00fa9a,
  mediumturquoise: 0x48d1cc,
  mediumvioletred: 0xc71585,
  midnightblue: 0x191970,
  mintcream: 0xf5fffa,
  mistyrose: 0xffe4e1,
  moccasin: 0xffe4b5,
  navajowhite: 0xffdead,
  navy: 0x000080,
  oldlace: 0xfdf5e6,
  olive: 0x808000,
  olivedrab: 0x6b8e23,
  orange: 0xffa500,
  orangered: 0xff4500,
  orchid: 0xda70d6,
  palegoldenrod: 0xeee8aa,
  palegreen: 0x98fb98,
  paleturquoise: 0xafeeee,
  palevioletred: 0xdb7093,
  papayawhip: 0xffefd5,
  peachpuff: 0xffdab9,
  peru: 0xcd853f,
  pink: 0xffc0cb,
  plum: 0xdda0dd,
  powderblue: 0xb0e0e6,
  purple: 0x800080,
  rebeccapurple: 0x663399,
  red: 0xff0000,
  rosybrown: 0xbc8f8f,
  royalblue: 0x4169e1,
  saddlebrown: 0x8b4513,
  salmon: 0xfa8072,
  sandybrown: 0xf4a460,
  seagreen: 0x2e8b57,
  seashell: 0xfff5ee,
  sienna: 0xa0522d,
  silver: 0xc0c0c0,
  skyblue: 0x87ceeb,
  slateblue: 0x6a5acd,
  slategray: 0x708090,
  slategrey: 0x708090,
  snow: 0xfffafa,
  springgreen: 0x00ff7f,
  steelblue: 0x4682b4,
  tan: 0xd2b48c,
  teal: 0x008080,
  thistle: 0xd8bfd8,
  tomato: 0xff6347,
  turquoise: 0x40e0d0,
  violet: 0xee82ee,
  wheat: 0xf5deb3,
  white: 0xffffff,
  whitesmoke: 0xf5f5f5,
  yellow: 0xffff00,
  yellowgreen: 0x9acd32
};

define(Color, color, {
  displayable: function() {
    return this.rgb().displayable();
  },
  hex: function() {
    return this.rgb().hex();
  },
  toString: function() {
    return this.rgb() + "";
  }
});

function color(format) {
  var m;
  format = (format + "").trim().toLowerCase();
  return (m = reHex3.exec(format)) ? (m = parseInt(m[1], 16), new Rgb((m >> 8 & 0xf) | (m >> 4 & 0x0f0), (m >> 4 & 0xf) | (m & 0xf0), ((m & 0xf) << 4) | (m & 0xf), 1)) // #f00
      : (m = reHex6.exec(format)) ? rgbn(parseInt(m[1], 16)) // #ff0000
      : (m = reRgbInteger.exec(format)) ? new Rgb(m[1], m[2], m[3], 1) // rgb(255, 0, 0)
      : (m = reRgbPercent.exec(format)) ? new Rgb(m[1] * 255 / 100, m[2] * 255 / 100, m[3] * 255 / 100, 1) // rgb(100%, 0%, 0%)
      : (m = reRgbaInteger.exec(format)) ? rgba(m[1], m[2], m[3], m[4]) // rgba(255, 0, 0, 1)
      : (m = reRgbaPercent.exec(format)) ? rgba(m[1] * 255 / 100, m[2] * 255 / 100, m[3] * 255 / 100, m[4]) // rgb(100%, 0%, 0%, 1)
      : (m = reHslPercent.exec(format)) ? hsla(m[1], m[2] / 100, m[3] / 100, 1) // hsl(120, 50%, 50%)
      : (m = reHslaPercent.exec(format)) ? hsla(m[1], m[2] / 100, m[3] / 100, m[4]) // hsla(120, 50%, 50%, 1)
      : named.hasOwnProperty(format) ? rgbn(named[format])
      : format === "transparent" ? new Rgb(NaN, NaN, NaN, 0)
      : null;
}

function rgbn(n) {
  return new Rgb(n >> 16 & 0xff, n >> 8 & 0xff, n & 0xff, 1);
}

function rgba(r, g, b, a) {
  if (a <= 0) r = g = b = NaN;
  return new Rgb(r, g, b, a);
}

function rgbConvert(o) {
  if (!(o instanceof Color)) o = color(o);
  if (!o) return new Rgb;
  o = o.rgb();
  return new Rgb(o.r, o.g, o.b, o.opacity);
}

function rgb(r, g, b, opacity) {
  return arguments.length === 1 ? rgbConvert(r) : new Rgb(r, g, b, opacity == null ? 1 : opacity);
}

function Rgb(r, g, b, opacity) {
  this.r = +r;
  this.g = +g;
  this.b = +b;
  this.opacity = +opacity;
}

define(Rgb, rgb, extend(Color, {
  brighter: function(k) {
    k = k == null ? brighter : Math.pow(brighter, k);
    return new Rgb(this.r * k, this.g * k, this.b * k, this.opacity);
  },
  darker: function(k) {
    k = k == null ? darker : Math.pow(darker, k);
    return new Rgb(this.r * k, this.g * k, this.b * k, this.opacity);
  },
  rgb: function() {
    return this;
  },
  displayable: function() {
    return (0 <= this.r && this.r <= 255)
        && (0 <= this.g && this.g <= 255)
        && (0 <= this.b && this.b <= 255)
        && (0 <= this.opacity && this.opacity <= 1);
  },
  hex: function() {
    return "#" + hex(this.r) + hex(this.g) + hex(this.b);
  },
  toString: function() {
    var a = this.opacity; a = isNaN(a) ? 1 : Math.max(0, Math.min(1, a));
    return (a === 1 ? "rgb(" : "rgba(")
        + Math.max(0, Math.min(255, Math.round(this.r) || 0)) + ", "
        + Math.max(0, Math.min(255, Math.round(this.g) || 0)) + ", "
        + Math.max(0, Math.min(255, Math.round(this.b) || 0))
        + (a === 1 ? ")" : ", " + a + ")");
  }
}));

function hex(value) {
  value = Math.max(0, Math.min(255, Math.round(value) || 0));
  return (value < 16 ? "0" : "") + value.toString(16);
}

function hsla(h, s, l, a) {
  if (a <= 0) h = s = l = NaN;
  else if (l <= 0 || l >= 1) h = s = NaN;
  else if (s <= 0) h = NaN;
  return new Hsl(h, s, l, a);
}

function hslConvert(o) {
  if (o instanceof Hsl) return new Hsl(o.h, o.s, o.l, o.opacity);
  if (!(o instanceof Color)) o = color(o);
  if (!o) return new Hsl;
  if (o instanceof Hsl) return o;
  o = o.rgb();
  var r = o.r / 255,
      g = o.g / 255,
      b = o.b / 255,
      min = Math.min(r, g, b),
      max = Math.max(r, g, b),
      h = NaN,
      s = max - min,
      l = (max + min) / 2;
  if (s) {
    if (r === max) h = (g - b) / s + (g < b) * 6;
    else if (g === max) h = (b - r) / s + 2;
    else h = (r - g) / s + 4;
    s /= l < 0.5 ? max + min : 2 - max - min;
    h *= 60;
  } else {
    s = l > 0 && l < 1 ? 0 : h;
  }
  return new Hsl(h, s, l, o.opacity);
}

function hsl(h, s, l, opacity) {
  return arguments.length === 1 ? hslConvert(h) : new Hsl(h, s, l, opacity == null ? 1 : opacity);
}

function Hsl(h, s, l, opacity) {
  this.h = +h;
  this.s = +s;
  this.l = +l;
  this.opacity = +opacity;
}

define(Hsl, hsl, extend(Color, {
  brighter: function(k) {
    k = k == null ? brighter : Math.pow(brighter, k);
    return new Hsl(this.h, this.s, this.l * k, this.opacity);
  },
  darker: function(k) {
    k = k == null ? darker : Math.pow(darker, k);
    return new Hsl(this.h, this.s, this.l * k, this.opacity);
  },
  rgb: function() {
    var h = this.h % 360 + (this.h < 0) * 360,
        s = isNaN(h) || isNaN(this.s) ? 0 : this.s,
        l = this.l,
        m2 = l + (l < 0.5 ? l : 1 - l) * s,
        m1 = 2 * l - m2;
    return new Rgb(
      hsl2rgb(h >= 240 ? h - 240 : h + 120, m1, m2),
      hsl2rgb(h, m1, m2),
      hsl2rgb(h < 120 ? h + 240 : h - 120, m1, m2),
      this.opacity
    );
  },
  displayable: function() {
    return (0 <= this.s && this.s <= 1 || isNaN(this.s))
        && (0 <= this.l && this.l <= 1)
        && (0 <= this.opacity && this.opacity <= 1);
  }
}));

/* From FvD 13.37, CSS Color Module Level 3 */
function hsl2rgb(h, m1, m2) {
  return (h < 60 ? m1 + (m2 - m1) * h / 60
      : h < 180 ? m2
      : h < 240 ? m1 + (m2 - m1) * (240 - h) / 60
      : m1) * 255;
}

var deg2rad = Math.PI / 180;
var rad2deg = 180 / Math.PI;

// https://beta.observablehq.com/@mbostock/lab-and-rgb
var K = 18,
    Xn = 0.96422,
    Yn = 1,
    Zn = 0.82521,
    t0 = 4 / 29,
    t1 = 6 / 29,
    t2 = 3 * t1 * t1,
    t3 = t1 * t1 * t1;

function labConvert(o) {
  if (o instanceof Lab) return new Lab(o.l, o.a, o.b, o.opacity);
  if (o instanceof Hcl) {
    if (isNaN(o.h)) return new Lab(o.l, 0, 0, o.opacity);
    var h = o.h * deg2rad;
    return new Lab(o.l, Math.cos(h) * o.c, Math.sin(h) * o.c, o.opacity);
  }
  if (!(o instanceof Rgb)) o = rgbConvert(o);
  var r = rgb2lrgb(o.r),
      g = rgb2lrgb(o.g),
      b = rgb2lrgb(o.b),
      y = xyz2lab((0.2225045 * r + 0.7168786 * g + 0.0606169 * b) / Yn), x, z;
  if (r === g && g === b) x = z = y; else {
    x = xyz2lab((0.4360747 * r + 0.3850649 * g + 0.1430804 * b) / Xn);
    z = xyz2lab((0.0139322 * r + 0.0971045 * g + 0.7141733 * b) / Zn);
  }
  return new Lab(116 * y - 16, 500 * (x - y), 200 * (y - z), o.opacity);
}

function lab(l, a, b, opacity) {
  return arguments.length === 1 ? labConvert(l) : new Lab(l, a, b, opacity == null ? 1 : opacity);
}

function Lab(l, a, b, opacity) {
  this.l = +l;
  this.a = +a;
  this.b = +b;
  this.opacity = +opacity;
}

define(Lab, lab, extend(Color, {
  brighter: function(k) {
    return new Lab(this.l + K * (k == null ? 1 : k), this.a, this.b, this.opacity);
  },
  darker: function(k) {
    return new Lab(this.l - K * (k == null ? 1 : k), this.a, this.b, this.opacity);
  },
  rgb: function() {
    var y = (this.l + 16) / 116,
        x = isNaN(this.a) ? y : y + this.a / 500,
        z = isNaN(this.b) ? y : y - this.b / 200;
    x = Xn * lab2xyz(x);
    y = Yn * lab2xyz(y);
    z = Zn * lab2xyz(z);
    return new Rgb(
      lrgb2rgb( 3.1338561 * x - 1.6168667 * y - 0.4906146 * z),
      lrgb2rgb(-0.9787684 * x + 1.9161415 * y + 0.0334540 * z),
      lrgb2rgb( 0.0719453 * x - 0.2289914 * y + 1.4052427 * z),
      this.opacity
    );
  }
}));

function xyz2lab(t) {
  return t > t3 ? Math.pow(t, 1 / 3) : t / t2 + t0;
}

function lab2xyz(t) {
  return t > t1 ? t * t * t : t2 * (t - t0);
}

function lrgb2rgb(x) {
  return 255 * (x <= 0.0031308 ? 12.92 * x : 1.055 * Math.pow(x, 1 / 2.4) - 0.055);
}

function rgb2lrgb(x) {
  return (x /= 255) <= 0.04045 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
}

function hclConvert(o) {
  if (o instanceof Hcl) return new Hcl(o.h, o.c, o.l, o.opacity);
  if (!(o instanceof Lab)) o = labConvert(o);
  if (o.a === 0 && o.b === 0) return new Hcl(NaN, 0, o.l, o.opacity);
  var h = Math.atan2(o.b, o.a) * rad2deg;
  return new Hcl(h < 0 ? h + 360 : h, Math.sqrt(o.a * o.a + o.b * o.b), o.l, o.opacity);
}

function hcl(h, c, l, opacity) {
  return arguments.length === 1 ? hclConvert(h) : new Hcl(h, c, l, opacity == null ? 1 : opacity);
}

function Hcl(h, c, l, opacity) {
  this.h = +h;
  this.c = +c;
  this.l = +l;
  this.opacity = +opacity;
}

define(Hcl, hcl, extend(Color, {
  brighter: function(k) {
    return new Hcl(this.h, this.c, this.l + K * (k == null ? 1 : k), this.opacity);
  },
  darker: function(k) {
    return new Hcl(this.h, this.c, this.l - K * (k == null ? 1 : k), this.opacity);
  },
  rgb: function() {
    return labConvert(this).rgb();
  }
}));

var A = -0.14861,
    B = +1.78277,
    C = -0.29227,
    D$1 = -0.90649,
    E = +1.97294,
    ED = E * D$1,
    EB = E * B,
    BC_DA = B * C - D$1 * A;

function cubehelixConvert(o) {
  if (o instanceof Cubehelix) return new Cubehelix(o.h, o.s, o.l, o.opacity);
  if (!(o instanceof Rgb)) o = rgbConvert(o);
  var r = o.r / 255,
      g = o.g / 255,
      b = o.b / 255,
      l = (BC_DA * b + ED * r - EB * g) / (BC_DA + ED - EB),
      bl = b - l,
      k = (E * (g - l) - C * bl) / D$1,
      s = Math.sqrt(k * k + bl * bl) / (E * l * (1 - l)), // NaN if l=0 or l=1
      h = s ? Math.atan2(k, bl) * rad2deg - 120 : NaN;
  return new Cubehelix(h < 0 ? h + 360 : h, s, l, o.opacity);
}

function cubehelix(h, s, l, opacity) {
  return arguments.length === 1 ? cubehelixConvert(h) : new Cubehelix(h, s, l, opacity == null ? 1 : opacity);
}

function Cubehelix(h, s, l, opacity) {
  this.h = +h;
  this.s = +s;
  this.l = +l;
  this.opacity = +opacity;
}

define(Cubehelix, cubehelix, extend(Color, {
  brighter: function(k) {
    k = k == null ? brighter : Math.pow(brighter, k);
    return new Cubehelix(this.h, this.s, this.l * k, this.opacity);
  },
  darker: function(k) {
    k = k == null ? darker : Math.pow(darker, k);
    return new Cubehelix(this.h, this.s, this.l * k, this.opacity);
  },
  rgb: function() {
    var h = isNaN(this.h) ? 0 : (this.h + 120) * deg2rad,
        l = +this.l,
        a = isNaN(this.s) ? 0 : this.s * l * (1 - l),
        cosh = Math.cos(h),
        sinh = Math.sin(h);
    return new Rgb(
      255 * (l + a * (A * cosh + B * sinh)),
      255 * (l + a * (C * cosh + D$1 * sinh)),
      255 * (l + a * (E * cosh)),
      this.opacity
    );
  }
}));

function basis(t1, v0, v1, v2, v3) {
  var t2 = t1 * t1, t3 = t2 * t1;
  return ((1 - 3 * t1 + 3 * t2 - t3) * v0
      + (4 - 6 * t2 + 3 * t3) * v1
      + (1 + 3 * t1 + 3 * t2 - 3 * t3) * v2
      + t3 * v3) / 6;
}

function basis$1(values) {
  var n = values.length - 1;
  return function(t) {
    var i = t <= 0 ? (t = 0) : t >= 1 ? (t = 1, n - 1) : Math.floor(t * n),
        v1 = values[i],
        v2 = values[i + 1],
        v0 = i > 0 ? values[i - 1] : 2 * v1 - v2,
        v3 = i < n - 1 ? values[i + 2] : 2 * v2 - v1;
    return basis((t - i / n) * n, v0, v1, v2, v3);
  };
}

function constant$1(x) {
  return function() {
    return x;
  };
}

function linear(a, d) {
  return function(t) {
    return a + t * d;
  };
}

function exponential(a, b, y) {
  return a = Math.pow(a, y), b = Math.pow(b, y) - a, y = 1 / y, function(t) {
    return Math.pow(a + t * b, y);
  };
}

function hue(a, b) {
  var d = b - a;
  return d ? linear(a, d > 180 || d < -180 ? d - 360 * Math.round(d / 360) : d) : constant$1(isNaN(a) ? b : a);
}

function gamma(y) {
  return (y = +y) === 1 ? nogamma : function(a, b) {
    return b - a ? exponential(a, b, y) : constant$1(isNaN(a) ? b : a);
  };
}

function nogamma(a, b) {
  var d = b - a;
  return d ? linear(a, d) : constant$1(isNaN(a) ? b : a);
}

var interpolateRgb = (function rgbGamma(y) {
  var color = gamma(y);

  function rgb$1(start, end) {
    var r = color((start = rgb(start)).r, (end = rgb(end)).r),
        g = color(start.g, end.g),
        b = color(start.b, end.b),
        opacity = nogamma(start.opacity, end.opacity);
    return function(t) {
      start.r = r(t);
      start.g = g(t);
      start.b = b(t);
      start.opacity = opacity(t);
      return start + "";
    };
  }

  rgb$1.gamma = rgbGamma;

  return rgb$1;
})(1);

function rgbSpline(spline) {
  return function(colors) {
    var n = colors.length,
        r = new Array(n),
        g = new Array(n),
        b = new Array(n),
        i, color;
    for (i = 0; i < n; ++i) {
      color = rgb(colors[i]);
      r[i] = color.r || 0;
      g[i] = color.g || 0;
      b[i] = color.b || 0;
    }
    r = spline(r);
    g = spline(g);
    b = spline(b);
    color.opacity = 1;
    return function(t) {
      color.r = r(t);
      color.g = g(t);
      color.b = b(t);
      return color + "";
    };
  };
}

var rgbBasis = rgbSpline(basis$1);

function array(a, b) {
  var nb = b ? b.length : 0,
      na = a ? Math.min(nb, a.length) : 0,
      x = new Array(na),
      c = new Array(nb),
      i;

  for (i = 0; i < na; ++i) x[i] = interpolateValue(a[i], b[i]);
  for (; i < nb; ++i) c[i] = b[i];

  return function(t) {
    for (i = 0; i < na; ++i) c[i] = x[i](t);
    return c;
  };
}

function date(a, b) {
  var d = new Date;
  return a = +a, b -= a, function(t) {
    return d.setTime(a + b * t), d;
  };
}

function interpolateNumber(a, b) {
  return a = +a, b -= a, function(t) {
    return a + b * t;
  };
}

function object(a, b) {
  var i = {},
      c = {},
      k;

  if (a === null || typeof a !== "object") a = {};
  if (b === null || typeof b !== "object") b = {};

  for (k in b) {
    if (k in a) {
      i[k] = interpolateValue(a[k], b[k]);
    } else {
      c[k] = b[k];
    }
  }

  return function(t) {
    for (k in i) c[k] = i[k](t);
    return c;
  };
}

var reA = /[-+]?(?:\d+\.?\d*|\.?\d+)(?:[eE][-+]?\d+)?/g,
    reB = new RegExp(reA.source, "g");

function zero(b) {
  return function() {
    return b;
  };
}

function one(b) {
  return function(t) {
    return b(t) + "";
  };
}

function interpolateString(a, b) {
  var bi = reA.lastIndex = reB.lastIndex = 0, // scan index for next number in b
      am, // current match in a
      bm, // current match in b
      bs, // string preceding current number in b, if any
      i = -1, // index in s
      s = [], // string constants and placeholders
      q = []; // number interpolators

  // Coerce inputs to strings.
  a = a + "", b = b + "";

  // Interpolate pairs of numbers in a & b.
  while ((am = reA.exec(a))
      && (bm = reB.exec(b))) {
    if ((bs = bm.index) > bi) { // a string precedes the next number in b
      bs = b.slice(bi, bs);
      if (s[i]) s[i] += bs; // coalesce with previous string
      else s[++i] = bs;
    }
    if ((am = am[0]) === (bm = bm[0])) { // numbers in a & b match
      if (s[i]) s[i] += bm; // coalesce with previous string
      else s[++i] = bm;
    } else { // interpolate non-matching numbers
      s[++i] = null;
      q.push({i: i, x: interpolateNumber(am, bm)});
    }
    bi = reB.lastIndex;
  }

  // Add remains of b.
  if (bi < b.length) {
    bs = b.slice(bi);
    if (s[i]) s[i] += bs; // coalesce with previous string
    else s[++i] = bs;
  }

  // Special optimization for only a single match.
  // Otherwise, interpolate each of the numbers and rejoin the string.
  return s.length < 2 ? (q[0]
      ? one(q[0].x)
      : zero(b))
      : (b = q.length, function(t) {
          for (var i = 0, o; i < b; ++i) s[(o = q[i]).i] = o.x(t);
          return s.join("");
        });
}

function interpolateValue(a, b) {
  var t = typeof b, c;
  return b == null || t === "boolean" ? constant$1(b)
      : (t === "number" ? interpolateNumber
      : t === "string" ? ((c = color(b)) ? (b = c, interpolateRgb) : interpolateString)
      : b instanceof color ? interpolateRgb
      : b instanceof Date ? date
      : Array.isArray(b) ? array
      : typeof b.valueOf !== "function" && typeof b.toString !== "function" || isNaN(b) ? object
      : interpolateNumber)(a, b);
}

function interpolateRound(a, b) {
  return a = +a, b -= a, function(t) {
    return Math.round(a + b * t);
  };
}

var degrees = 180 / Math.PI;

var identity$1 = {
  translateX: 0,
  translateY: 0,
  rotate: 0,
  skewX: 0,
  scaleX: 1,
  scaleY: 1
};

function decompose(a, b, c, d, e, f) {
  var scaleX, scaleY, skewX;
  if (scaleX = Math.sqrt(a * a + b * b)) a /= scaleX, b /= scaleX;
  if (skewX = a * c + b * d) c -= a * skewX, d -= b * skewX;
  if (scaleY = Math.sqrt(c * c + d * d)) c /= scaleY, d /= scaleY, skewX /= scaleY;
  if (a * d < b * c) a = -a, b = -b, skewX = -skewX, scaleX = -scaleX;
  return {
    translateX: e,
    translateY: f,
    rotate: Math.atan2(b, a) * degrees,
    skewX: Math.atan(skewX) * degrees,
    scaleX: scaleX,
    scaleY: scaleY
  };
}

var cssNode,
    cssRoot,
    cssView,
    svgNode;

function parseCss(value) {
  if (value === "none") return identity$1;
  if (!cssNode) cssNode = document.createElement("DIV"), cssRoot = document.documentElement, cssView = document.defaultView;
  cssNode.style.transform = value;
  value = cssView.getComputedStyle(cssRoot.appendChild(cssNode), null).getPropertyValue("transform");
  cssRoot.removeChild(cssNode);
  value = value.slice(7, -1).split(",");
  return decompose(+value[0], +value[1], +value[2], +value[3], +value[4], +value[5]);
}

function parseSvg(value) {
  if (value == null) return identity$1;
  if (!svgNode) svgNode = document.createElementNS("http://www.w3.org/2000/svg", "g");
  svgNode.setAttribute("transform", value);
  if (!(value = svgNode.transform.baseVal.consolidate())) return identity$1;
  value = value.matrix;
  return decompose(value.a, value.b, value.c, value.d, value.e, value.f);
}

function interpolateTransform(parse, pxComma, pxParen, degParen) {

  function pop(s) {
    return s.length ? s.pop() + " " : "";
  }

  function translate(xa, ya, xb, yb, s, q) {
    if (xa !== xb || ya !== yb) {
      var i = s.push("translate(", null, pxComma, null, pxParen);
      q.push({i: i - 4, x: interpolateNumber(xa, xb)}, {i: i - 2, x: interpolateNumber(ya, yb)});
    } else if (xb || yb) {
      s.push("translate(" + xb + pxComma + yb + pxParen);
    }
  }

  function rotate(a, b, s, q) {
    if (a !== b) {
      if (a - b > 180) b += 360; else if (b - a > 180) a += 360; // shortest path
      q.push({i: s.push(pop(s) + "rotate(", null, degParen) - 2, x: interpolateNumber(a, b)});
    } else if (b) {
      s.push(pop(s) + "rotate(" + b + degParen);
    }
  }

  function skewX(a, b, s, q) {
    if (a !== b) {
      q.push({i: s.push(pop(s) + "skewX(", null, degParen) - 2, x: interpolateNumber(a, b)});
    } else if (b) {
      s.push(pop(s) + "skewX(" + b + degParen);
    }
  }

  function scale(xa, ya, xb, yb, s, q) {
    if (xa !== xb || ya !== yb) {
      var i = s.push(pop(s) + "scale(", null, ",", null, ")");
      q.push({i: i - 4, x: interpolateNumber(xa, xb)}, {i: i - 2, x: interpolateNumber(ya, yb)});
    } else if (xb !== 1 || yb !== 1) {
      s.push(pop(s) + "scale(" + xb + "," + yb + ")");
    }
  }

  return function(a, b) {
    var s = [], // string constants and placeholders
        q = []; // number interpolators
    a = parse(a), b = parse(b);
    translate(a.translateX, a.translateY, b.translateX, b.translateY, s, q);
    rotate(a.rotate, b.rotate, s, q);
    skewX(a.skewX, b.skewX, s, q);
    scale(a.scaleX, a.scaleY, b.scaleX, b.scaleY, s, q);
    a = b = null; // gc
    return function(t) {
      var i = -1, n = q.length, o;
      while (++i < n) s[(o = q[i]).i] = o.x(t);
      return s.join("");
    };
  };
}

var interpolateTransformCss = interpolateTransform(parseCss, "px, ", "px)", "deg)");
var interpolateTransformSvg = interpolateTransform(parseSvg, ", ", ")", ")");

var rho = Math.SQRT2;

function cubehelix$1(hue) {
  return (function cubehelixGamma(y) {
    y = +y;

    function cubehelix$1(start, end) {
      var h = hue((start = cubehelix(start)).h, (end = cubehelix(end)).h),
          s = nogamma(start.s, end.s),
          l = nogamma(start.l, end.l),
          opacity = nogamma(start.opacity, end.opacity);
      return function(t) {
        start.h = h(t);
        start.s = s(t);
        start.l = l(Math.pow(t, y));
        start.opacity = opacity(t);
        return start + "";
      };
    }

    cubehelix$1.gamma = cubehelixGamma;

    return cubehelix$1;
  })(1);
}

cubehelix$1(hue);
var cubehelixLong = cubehelix$1(nogamma);

var frame = 0, // is an animation frame pending?
    timeout = 0, // is a timeout pending?
    interval = 0, // are any timers active?
    pokeDelay = 1000, // how frequently we check for clock skew
    taskHead,
    taskTail,
    clockLast = 0,
    clockNow = 0,
    clockSkew = 0,
    clock = typeof performance === "object" && performance.now ? performance : Date,
    setFrame = typeof window === "object" && window.requestAnimationFrame ? window.requestAnimationFrame.bind(window) : function(f) { setTimeout(f, 17); };

function now() {
  return clockNow || (setFrame(clearNow), clockNow = clock.now() + clockSkew);
}

function clearNow() {
  clockNow = 0;
}

function Timer() {
  this._call =
  this._time =
  this._next = null;
}

Timer.prototype = timer.prototype = {
  constructor: Timer,
  restart: function(callback, delay, time) {
    if (typeof callback !== "function") throw new TypeError("callback is not a function");
    time = (time == null ? now() : +time) + (delay == null ? 0 : +delay);
    if (!this._next && taskTail !== this) {
      if (taskTail) taskTail._next = this;
      else taskHead = this;
      taskTail = this;
    }
    this._call = callback;
    this._time = time;
    sleep();
  },
  stop: function() {
    if (this._call) {
      this._call = null;
      this._time = Infinity;
      sleep();
    }
  }
};

function timer(callback, delay, time) {
  var t = new Timer;
  t.restart(callback, delay, time);
  return t;
}

function timerFlush() {
  now(); // Get the current time, if not already set.
  ++frame; // Pretend we’ve set an alarm, if we haven’t already.
  var t = taskHead, e;
  while (t) {
    if ((e = clockNow - t._time) >= 0) t._call.call(null, e);
    t = t._next;
  }
  --frame;
}

function wake() {
  clockNow = (clockLast = clock.now()) + clockSkew;
  frame = timeout = 0;
  try {
    timerFlush();
  } finally {
    frame = 0;
    nap();
    clockNow = 0;
  }
}

function poke() {
  var now = clock.now(), delay = now - clockLast;
  if (delay > pokeDelay) clockSkew -= delay, clockLast = now;
}

function nap() {
  var t0, t1 = taskHead, t2, time = Infinity;
  while (t1) {
    if (t1._call) {
      if (time > t1._time) time = t1._time;
      t0 = t1, t1 = t1._next;
    } else {
      t2 = t1._next, t1._next = null;
      t1 = t0 ? t0._next = t2 : taskHead = t2;
    }
  }
  taskTail = t0;
  sleep(time);
}

function sleep(time) {
  if (frame) return; // Soonest alarm already set, or will be.
  if (timeout) timeout = clearTimeout(timeout);
  var delay = time - clockNow; // Strictly less than if we recomputed clockNow.
  if (delay > 24) {
    if (time < Infinity) timeout = setTimeout(wake, time - clock.now() - clockSkew);
    if (interval) interval = clearInterval(interval);
  } else {
    if (!interval) clockLast = clock.now(), interval = setInterval(poke, pokeDelay);
    frame = 1, setFrame(wake);
  }
}

function timeout$1(callback, delay, time) {
  var t = new Timer;
  delay = delay == null ? 0 : +delay;
  t.restart(function(elapsed) {
    t.stop();
    callback(elapsed + delay);
  }, delay, time);
  return t;
}

var emptyOn = dispatch("start", "end", "cancel", "interrupt");
var emptyTween = [];

var CREATED = 0;
var SCHEDULED = 1;
var STARTING = 2;
var STARTED = 3;
var RUNNING = 4;
var ENDING = 5;
var ENDED = 6;

function schedule(node, name, id, index, group, timing) {
  var schedules = node.__transition;
  if (!schedules) node.__transition = {};
  else if (id in schedules) return;
  create(node, id, {
    name: name,
    index: index, // For context during callback.
    group: group, // For context during callback.
    on: emptyOn,
    tween: emptyTween,
    time: timing.time,
    delay: timing.delay,
    duration: timing.duration,
    ease: timing.ease,
    timer: null,
    state: CREATED
  });
}

function init(node, id) {
  var schedule = get$1(node, id);
  if (schedule.state > CREATED) throw new Error("too late; already scheduled");
  return schedule;
}

function set$1(node, id) {
  var schedule = get$1(node, id);
  if (schedule.state > STARTED) throw new Error("too late; already running");
  return schedule;
}

function get$1(node, id) {
  var schedule = node.__transition;
  if (!schedule || !(schedule = schedule[id])) throw new Error("transition not found");
  return schedule;
}

function create(node, id, self) {
  var schedules = node.__transition,
      tween;

  // Initialize the self timer when the transition is created.
  // Note the actual delay is not known until the first callback!
  schedules[id] = self;
  self.timer = timer(schedule, 0, self.time);

  function schedule(elapsed) {
    self.state = SCHEDULED;
    self.timer.restart(start, self.delay, self.time);

    // If the elapsed delay is less than our first sleep, start immediately.
    if (self.delay <= elapsed) start(elapsed - self.delay);
  }

  function start(elapsed) {
    var i, j, n, o;

    // If the state is not SCHEDULED, then we previously errored on start.
    if (self.state !== SCHEDULED) return stop();

    for (i in schedules) {
      o = schedules[i];
      if (o.name !== self.name) continue;

      // While this element already has a starting transition during this frame,
      // defer starting an interrupting transition until that transition has a
      // chance to tick (and possibly end); see d3/d3-transition#54!
      if (o.state === STARTED) return timeout$1(start);

      // Interrupt the active transition, if any.
      if (o.state === RUNNING) {
        o.state = ENDED;
        o.timer.stop();
        o.on.call("interrupt", node, node.__data__, o.index, o.group);
        delete schedules[i];
      }

      // Cancel any pre-empted transitions.
      else if (+i < id) {
        o.state = ENDED;
        o.timer.stop();
        o.on.call("cancel", node, node.__data__, o.index, o.group);
        delete schedules[i];
      }
    }

    // Defer the first tick to end of the current frame; see d3/d3#1576.
    // Note the transition may be canceled after start and before the first tick!
    // Note this must be scheduled before the start event; see d3/d3-transition#16!
    // Assuming this is successful, subsequent callbacks go straight to tick.
    timeout$1(function() {
      if (self.state === STARTED) {
        self.state = RUNNING;
        self.timer.restart(tick, self.delay, self.time);
        tick(elapsed);
      }
    });

    // Dispatch the start event.
    // Note this must be done before the tween are initialized.
    self.state = STARTING;
    self.on.call("start", node, node.__data__, self.index, self.group);
    if (self.state !== STARTING) return; // interrupted
    self.state = STARTED;

    // Initialize the tween, deleting null tween.
    tween = new Array(n = self.tween.length);
    for (i = 0, j = -1; i < n; ++i) {
      if (o = self.tween[i].value.call(node, node.__data__, self.index, self.group)) {
        tween[++j] = o;
      }
    }
    tween.length = j + 1;
  }

  function tick(elapsed) {
    var t = elapsed < self.duration ? self.ease.call(null, elapsed / self.duration) : (self.timer.restart(stop), self.state = ENDING, 1),
        i = -1,
        n = tween.length;

    while (++i < n) {
      tween[i].call(node, t);
    }

    // Dispatch the end event.
    if (self.state === ENDING) {
      self.on.call("end", node, node.__data__, self.index, self.group);
      stop();
    }
  }

  function stop() {
    self.state = ENDED;
    self.timer.stop();
    delete schedules[id];
    for (var i in schedules) return; // eslint-disable-line no-unused-vars
    delete node.__transition;
  }
}

function interrupt(node, name) {
  var schedules = node.__transition,
      schedule,
      active,
      empty = true,
      i;

  if (!schedules) return;

  name = name == null ? null : name + "";

  for (i in schedules) {
    if ((schedule = schedules[i]).name !== name) { empty = false; continue; }
    active = schedule.state > STARTING && schedule.state < ENDING;
    schedule.state = ENDED;
    schedule.timer.stop();
    schedule.on.call(active ? "interrupt" : "cancel", node, node.__data__, schedule.index, schedule.group);
    delete schedules[i];
  }

  if (empty) delete node.__transition;
}

function selection_interrupt(name) {
  return this.each(function() {
    interrupt(this, name);
  });
}

function tweenRemove(id, name) {
  var tween0, tween1;
  return function() {
    var schedule = set$1(this, id),
        tween = schedule.tween;

    // If this node shared tween with the previous node,
    // just assign the updated shared tween and we’re done!
    // Otherwise, copy-on-write.
    if (tween !== tween0) {
      tween1 = tween0 = tween;
      for (var i = 0, n = tween1.length; i < n; ++i) {
        if (tween1[i].name === name) {
          tween1 = tween1.slice();
          tween1.splice(i, 1);
          break;
        }
      }
    }

    schedule.tween = tween1;
  };
}

function tweenFunction(id, name, value) {
  var tween0, tween1;
  if (typeof value !== "function") throw new Error;
  return function() {
    var schedule = set$1(this, id),
        tween = schedule.tween;

    // If this node shared tween with the previous node,
    // just assign the updated shared tween and we’re done!
    // Otherwise, copy-on-write.
    if (tween !== tween0) {
      tween1 = (tween0 = tween).slice();
      for (var t = {name: name, value: value}, i = 0, n = tween1.length; i < n; ++i) {
        if (tween1[i].name === name) {
          tween1[i] = t;
          break;
        }
      }
      if (i === n) tween1.push(t);
    }

    schedule.tween = tween1;
  };
}

function transition_tween(name, value) {
  var id = this._id;

  name += "";

  if (arguments.length < 2) {
    var tween = get$1(this.node(), id).tween;
    for (var i = 0, n = tween.length, t; i < n; ++i) {
      if ((t = tween[i]).name === name) {
        return t.value;
      }
    }
    return null;
  }

  return this.each((value == null ? tweenRemove : tweenFunction)(id, name, value));
}

function tweenValue(transition, name, value) {
  var id = transition._id;

  transition.each(function() {
    var schedule = set$1(this, id);
    (schedule.value || (schedule.value = {}))[name] = value.apply(this, arguments);
  });

  return function(node) {
    return get$1(node, id).value[name];
  };
}

function interpolate(a, b) {
  var c;
  return (typeof b === "number" ? interpolateNumber
      : b instanceof color ? interpolateRgb
      : (c = color(b)) ? (b = c, interpolateRgb)
      : interpolateString)(a, b);
}

function attrRemove$1(name) {
  return function() {
    this.removeAttribute(name);
  };
}

function attrRemoveNS$1(fullname) {
  return function() {
    this.removeAttributeNS(fullname.space, fullname.local);
  };
}

function attrConstant$1(name, interpolate, value1) {
  var string00,
      string1 = value1 + "",
      interpolate0;
  return function() {
    var string0 = this.getAttribute(name);
    return string0 === string1 ? null
        : string0 === string00 ? interpolate0
        : interpolate0 = interpolate(string00 = string0, value1);
  };
}

function attrConstantNS$1(fullname, interpolate, value1) {
  var string00,
      string1 = value1 + "",
      interpolate0;
  return function() {
    var string0 = this.getAttributeNS(fullname.space, fullname.local);
    return string0 === string1 ? null
        : string0 === string00 ? interpolate0
        : interpolate0 = interpolate(string00 = string0, value1);
  };
}

function attrFunction$1(name, interpolate, value) {
  var string00,
      string10,
      interpolate0;
  return function() {
    var string0, value1 = value(this), string1;
    if (value1 == null) return void this.removeAttribute(name);
    string0 = this.getAttribute(name);
    string1 = value1 + "";
    return string0 === string1 ? null
        : string0 === string00 && string1 === string10 ? interpolate0
        : (string10 = string1, interpolate0 = interpolate(string00 = string0, value1));
  };
}

function attrFunctionNS$1(fullname, interpolate, value) {
  var string00,
      string10,
      interpolate0;
  return function() {
    var string0, value1 = value(this), string1;
    if (value1 == null) return void this.removeAttributeNS(fullname.space, fullname.local);
    string0 = this.getAttributeNS(fullname.space, fullname.local);
    string1 = value1 + "";
    return string0 === string1 ? null
        : string0 === string00 && string1 === string10 ? interpolate0
        : (string10 = string1, interpolate0 = interpolate(string00 = string0, value1));
  };
}

function transition_attr(name, value) {
  var fullname = namespace(name), i = fullname === "transform" ? interpolateTransformSvg : interpolate;
  return this.attrTween(name, typeof value === "function"
      ? (fullname.local ? attrFunctionNS$1 : attrFunction$1)(fullname, i, tweenValue(this, "attr." + name, value))
      : value == null ? (fullname.local ? attrRemoveNS$1 : attrRemove$1)(fullname)
      : (fullname.local ? attrConstantNS$1 : attrConstant$1)(fullname, i, value));
}

function attrInterpolate(name, i) {
  return function(t) {
    this.setAttribute(name, i(t));
  };
}

function attrInterpolateNS(fullname, i) {
  return function(t) {
    this.setAttributeNS(fullname.space, fullname.local, i(t));
  };
}

function attrTweenNS(fullname, value) {
  var t0, i0;
  function tween() {
    var i = value.apply(this, arguments);
    if (i !== i0) t0 = (i0 = i) && attrInterpolateNS(fullname, i);
    return t0;
  }
  tween._value = value;
  return tween;
}

function attrTween(name, value) {
  var t0, i0;
  function tween() {
    var i = value.apply(this, arguments);
    if (i !== i0) t0 = (i0 = i) && attrInterpolate(name, i);
    return t0;
  }
  tween._value = value;
  return tween;
}

function transition_attrTween(name, value) {
  var key = "attr." + name;
  if (arguments.length < 2) return (key = this.tween(key)) && key._value;
  if (value == null) return this.tween(key, null);
  if (typeof value !== "function") throw new Error;
  var fullname = namespace(name);
  return this.tween(key, (fullname.local ? attrTweenNS : attrTween)(fullname, value));
}

function delayFunction(id, value) {
  return function() {
    init(this, id).delay = +value.apply(this, arguments);
  };
}

function delayConstant(id, value) {
  return value = +value, function() {
    init(this, id).delay = value;
  };
}

function transition_delay(value) {
  var id = this._id;

  return arguments.length
      ? this.each((typeof value === "function"
          ? delayFunction
          : delayConstant)(id, value))
      : get$1(this.node(), id).delay;
}

function durationFunction(id, value) {
  return function() {
    set$1(this, id).duration = +value.apply(this, arguments);
  };
}

function durationConstant(id, value) {
  return value = +value, function() {
    set$1(this, id).duration = value;
  };
}

function transition_duration(value) {
  var id = this._id;

  return arguments.length
      ? this.each((typeof value === "function"
          ? durationFunction
          : durationConstant)(id, value))
      : get$1(this.node(), id).duration;
}

function easeConstant(id, value) {
  if (typeof value !== "function") throw new Error;
  return function() {
    set$1(this, id).ease = value;
  };
}

function transition_ease(value) {
  var id = this._id;

  return arguments.length
      ? this.each(easeConstant(id, value))
      : get$1(this.node(), id).ease;
}

function transition_filter(match) {
  if (typeof match !== "function") match = matcher(match);

  for (var groups = this._groups, m = groups.length, subgroups = new Array(m), j = 0; j < m; ++j) {
    for (var group = groups[j], n = group.length, subgroup = subgroups[j] = [], node, i = 0; i < n; ++i) {
      if ((node = group[i]) && match.call(node, node.__data__, i, group)) {
        subgroup.push(node);
      }
    }
  }

  return new Transition(subgroups, this._parents, this._name, this._id);
}

function transition_merge(transition) {
  if (transition._id !== this._id) throw new Error;

  for (var groups0 = this._groups, groups1 = transition._groups, m0 = groups0.length, m1 = groups1.length, m = Math.min(m0, m1), merges = new Array(m0), j = 0; j < m; ++j) {
    for (var group0 = groups0[j], group1 = groups1[j], n = group0.length, merge = merges[j] = new Array(n), node, i = 0; i < n; ++i) {
      if (node = group0[i] || group1[i]) {
        merge[i] = node;
      }
    }
  }

  for (; j < m0; ++j) {
    merges[j] = groups0[j];
  }

  return new Transition(merges, this._parents, this._name, this._id);
}

function start(name) {
  return (name + "").trim().split(/^|\s+/).every(function(t) {
    var i = t.indexOf(".");
    if (i >= 0) t = t.slice(0, i);
    return !t || t === "start";
  });
}

function onFunction(id, name, listener) {
  var on0, on1, sit = start(name) ? init : set$1;
  return function() {
    var schedule = sit(this, id),
        on = schedule.on;

    // If this node shared a dispatch with the previous node,
    // just assign the updated shared dispatch and we’re done!
    // Otherwise, copy-on-write.
    if (on !== on0) (on1 = (on0 = on).copy()).on(name, listener);

    schedule.on = on1;
  };
}

function transition_on(name, listener) {
  var id = this._id;

  return arguments.length < 2
      ? get$1(this.node(), id).on.on(name)
      : this.each(onFunction(id, name, listener));
}

function removeFunction(id) {
  return function() {
    var parent = this.parentNode;
    for (var i in this.__transition) if (+i !== id) return;
    if (parent) parent.removeChild(this);
  };
}

function transition_remove() {
  return this.on("end.remove", removeFunction(this._id));
}

function transition_select(select) {
  var name = this._name,
      id = this._id;

  if (typeof select !== "function") select = selector(select);

  for (var groups = this._groups, m = groups.length, subgroups = new Array(m), j = 0; j < m; ++j) {
    for (var group = groups[j], n = group.length, subgroup = subgroups[j] = new Array(n), node, subnode, i = 0; i < n; ++i) {
      if ((node = group[i]) && (subnode = select.call(node, node.__data__, i, group))) {
        if ("__data__" in node) subnode.__data__ = node.__data__;
        subgroup[i] = subnode;
        schedule(subgroup[i], name, id, i, subgroup, get$1(node, id));
      }
    }
  }

  return new Transition(subgroups, this._parents, name, id);
}

function transition_selectAll(select) {
  var name = this._name,
      id = this._id;

  if (typeof select !== "function") select = selectorAll(select);

  for (var groups = this._groups, m = groups.length, subgroups = [], parents = [], j = 0; j < m; ++j) {
    for (var group = groups[j], n = group.length, node, i = 0; i < n; ++i) {
      if (node = group[i]) {
        for (var children = select.call(node, node.__data__, i, group), child, inherit = get$1(node, id), k = 0, l = children.length; k < l; ++k) {
          if (child = children[k]) {
            schedule(child, name, id, k, children, inherit);
          }
        }
        subgroups.push(children);
        parents.push(node);
      }
    }
  }

  return new Transition(subgroups, parents, name, id);
}

var Selection$1 = selection.prototype.constructor;

function transition_selection() {
  return new Selection$1(this._groups, this._parents);
}

function styleNull(name, interpolate) {
  var string00,
      string10,
      interpolate0;
  return function() {
    var string0 = styleValue(this, name),
        string1 = (this.style.removeProperty(name), styleValue(this, name));
    return string0 === string1 ? null
        : string0 === string00 && string1 === string10 ? interpolate0
        : interpolate0 = interpolate(string00 = string0, string10 = string1);
  };
}

function styleRemove$1(name) {
  return function() {
    this.style.removeProperty(name);
  };
}

function styleConstant$1(name, interpolate, value1) {
  var string00,
      string1 = value1 + "",
      interpolate0;
  return function() {
    var string0 = styleValue(this, name);
    return string0 === string1 ? null
        : string0 === string00 ? interpolate0
        : interpolate0 = interpolate(string00 = string0, value1);
  };
}

function styleFunction$1(name, interpolate, value) {
  var string00,
      string10,
      interpolate0;
  return function() {
    var string0 = styleValue(this, name),
        value1 = value(this),
        string1 = value1 + "";
    if (value1 == null) string1 = value1 = (this.style.removeProperty(name), styleValue(this, name));
    return string0 === string1 ? null
        : string0 === string00 && string1 === string10 ? interpolate0
        : (string10 = string1, interpolate0 = interpolate(string00 = string0, value1));
  };
}

function styleMaybeRemove(id, name) {
  var on0, on1, listener0, key = "style." + name, event = "end." + key, remove;
  return function() {
    var schedule = set$1(this, id),
        on = schedule.on,
        listener = schedule.value[key] == null ? remove || (remove = styleRemove$1(name)) : undefined;

    // If this node shared a dispatch with the previous node,
    // just assign the updated shared dispatch and we’re done!
    // Otherwise, copy-on-write.
    if (on !== on0 || listener0 !== listener) (on1 = (on0 = on).copy()).on(event, listener0 = listener);

    schedule.on = on1;
  };
}

function transition_style(name, value, priority) {
  var i = (name += "") === "transform" ? interpolateTransformCss : interpolate;
  return value == null ? this
      .styleTween(name, styleNull(name, i))
      .on("end.style." + name, styleRemove$1(name))
    : typeof value === "function" ? this
      .styleTween(name, styleFunction$1(name, i, tweenValue(this, "style." + name, value)))
      .each(styleMaybeRemove(this._id, name))
    : this
      .styleTween(name, styleConstant$1(name, i, value), priority)
      .on("end.style." + name, null);
}

function styleInterpolate(name, i, priority) {
  return function(t) {
    this.style.setProperty(name, i(t), priority);
  };
}

function styleTween(name, value, priority) {
  var t, i0;
  function tween() {
    var i = value.apply(this, arguments);
    if (i !== i0) t = (i0 = i) && styleInterpolate(name, i, priority);
    return t;
  }
  tween._value = value;
  return tween;
}

function transition_styleTween(name, value, priority) {
  var key = "style." + (name += "");
  if (arguments.length < 2) return (key = this.tween(key)) && key._value;
  if (value == null) return this.tween(key, null);
  if (typeof value !== "function") throw new Error;
  return this.tween(key, styleTween(name, value, priority == null ? "" : priority));
}

function textConstant$1(value) {
  return function() {
    this.textContent = value;
  };
}

function textFunction$1(value) {
  return function() {
    var value1 = value(this);
    this.textContent = value1 == null ? "" : value1;
  };
}

function transition_text(value) {
  return this.tween("text", typeof value === "function"
      ? textFunction$1(tweenValue(this, "text", value))
      : textConstant$1(value == null ? "" : value + ""));
}

function transition_transition() {
  var name = this._name,
      id0 = this._id,
      id1 = newId();

  for (var groups = this._groups, m = groups.length, j = 0; j < m; ++j) {
    for (var group = groups[j], n = group.length, node, i = 0; i < n; ++i) {
      if (node = group[i]) {
        var inherit = get$1(node, id0);
        schedule(node, name, id1, i, group, {
          time: inherit.time + inherit.delay + inherit.duration,
          delay: 0,
          duration: inherit.duration,
          ease: inherit.ease
        });
      }
    }
  }

  return new Transition(groups, this._parents, name, id1);
}

function transition_end() {
  var on0, on1, that = this, id = that._id, size = that.size();
  return new Promise(function(resolve, reject) {
    var cancel = {value: reject},
        end = {value: function() { if (--size === 0) resolve(); }};

    that.each(function() {
      var schedule = set$1(this, id),
          on = schedule.on;

      // If this node shared a dispatch with the previous node,
      // just assign the updated shared dispatch and we’re done!
      // Otherwise, copy-on-write.
      if (on !== on0) {
        on1 = (on0 = on).copy();
        on1._.cancel.push(cancel);
        on1._.interrupt.push(cancel);
        on1._.end.push(end);
      }

      schedule.on = on1;
    });
  });
}

var id = 0;

function Transition(groups, parents, name, id) {
  this._groups = groups;
  this._parents = parents;
  this._name = name;
  this._id = id;
}

function transition(name) {
  return selection().transition(name);
}

function newId() {
  return ++id;
}

var selection_prototype = selection.prototype;

Transition.prototype = transition.prototype = {
  constructor: Transition,
  select: transition_select,
  selectAll: transition_selectAll,
  filter: transition_filter,
  merge: transition_merge,
  selection: transition_selection,
  transition: transition_transition,
  call: selection_prototype.call,
  nodes: selection_prototype.nodes,
  node: selection_prototype.node,
  size: selection_prototype.size,
  empty: selection_prototype.empty,
  each: selection_prototype.each,
  on: transition_on,
  attr: transition_attr,
  attrTween: transition_attrTween,
  style: transition_style,
  styleTween: transition_styleTween,
  text: transition_text,
  remove: transition_remove,
  tween: transition_tween,
  delay: transition_delay,
  duration: transition_duration,
  ease: transition_ease,
  end: transition_end
};

function cubicInOut(t) {
  return ((t *= 2) <= 1 ? t * t * t : (t -= 2) * t * t + 2) / 2;
}

var pi = Math.PI;

var tau = 2 * Math.PI;

var defaultTiming = {
  time: null, // Set on use.
  delay: 0,
  duration: 250,
  ease: cubicInOut
};

function inherit(node, id) {
  var timing;
  while (!(timing = node.__transition) || !(timing = timing[id])) {
    if (!(node = node.parentNode)) {
      return defaultTiming.time = now(), defaultTiming;
    }
  }
  return timing;
}

function selection_transition(name) {
  var id,
      timing;

  if (name instanceof Transition) {
    id = name._id, name = name._name;
  } else {
    id = newId(), (timing = defaultTiming).time = now(), name = name == null ? null : name + "";
  }

  for (var groups = this._groups, m = groups.length, j = 0; j < m; ++j) {
    for (var group = groups[j], n = group.length, node, i = 0; i < n; ++i) {
      if (node = group[i]) {
        schedule(node, name, id, i, group, timing || inherit(node, id));
      }
    }
  }

  return new Transition(groups, this._parents, name, id);
}

selection.prototype.interrupt = selection_interrupt;
selection.prototype.transition = selection_transition;

var pi$1 = Math.PI;

var pi$2 = Math.PI,
    tau$1 = 2 * pi$2,
    epsilon$1 = 1e-6,
    tauEpsilon = tau$1 - epsilon$1;

function Path() {
  this._x0 = this._y0 = // start of current subpath
  this._x1 = this._y1 = null; // end of current subpath
  this._ = "";
}

function path$1() {
  return new Path;
}

Path.prototype = path$1.prototype = {
  constructor: Path,
  moveTo: function(x, y) {
    this._ += "M" + (this._x0 = this._x1 = +x) + "," + (this._y0 = this._y1 = +y);
  },
  closePath: function() {
    if (this._x1 !== null) {
      this._x1 = this._x0, this._y1 = this._y0;
      this._ += "Z";
    }
  },
  lineTo: function(x, y) {
    this._ += "L" + (this._x1 = +x) + "," + (this._y1 = +y);
  },
  quadraticCurveTo: function(x1, y1, x, y) {
    this._ += "Q" + (+x1) + "," + (+y1) + "," + (this._x1 = +x) + "," + (this._y1 = +y);
  },
  bezierCurveTo: function(x1, y1, x2, y2, x, y) {
    this._ += "C" + (+x1) + "," + (+y1) + "," + (+x2) + "," + (+y2) + "," + (this._x1 = +x) + "," + (this._y1 = +y);
  },
  arcTo: function(x1, y1, x2, y2, r) {
    x1 = +x1, y1 = +y1, x2 = +x2, y2 = +y2, r = +r;
    var x0 = this._x1,
        y0 = this._y1,
        x21 = x2 - x1,
        y21 = y2 - y1,
        x01 = x0 - x1,
        y01 = y0 - y1,
        l01_2 = x01 * x01 + y01 * y01;

    // Is the radius negative? Error.
    if (r < 0) throw new Error("negative radius: " + r);

    // Is this path empty? Move to (x1,y1).
    if (this._x1 === null) {
      this._ += "M" + (this._x1 = x1) + "," + (this._y1 = y1);
    }

    // Or, is (x1,y1) coincident with (x0,y0)? Do nothing.
    else if (!(l01_2 > epsilon$1));

    // Or, are (x0,y0), (x1,y1) and (x2,y2) collinear?
    // Equivalently, is (x1,y1) coincident with (x2,y2)?
    // Or, is the radius zero? Line to (x1,y1).
    else if (!(Math.abs(y01 * x21 - y21 * x01) > epsilon$1) || !r) {
      this._ += "L" + (this._x1 = x1) + "," + (this._y1 = y1);
    }

    // Otherwise, draw an arc!
    else {
      var x20 = x2 - x0,
          y20 = y2 - y0,
          l21_2 = x21 * x21 + y21 * y21,
          l20_2 = x20 * x20 + y20 * y20,
          l21 = Math.sqrt(l21_2),
          l01 = Math.sqrt(l01_2),
          l = r * Math.tan((pi$2 - Math.acos((l21_2 + l01_2 - l20_2) / (2 * l21 * l01))) / 2),
          t01 = l / l01,
          t21 = l / l21;

      // If the start tangent is not coincident with (x0,y0), line to.
      if (Math.abs(t01 - 1) > epsilon$1) {
        this._ += "L" + (x1 + t01 * x01) + "," + (y1 + t01 * y01);
      }

      this._ += "A" + r + "," + r + ",0,0," + (+(y01 * x20 > x01 * y20)) + "," + (this._x1 = x1 + t21 * x21) + "," + (this._y1 = y1 + t21 * y21);
    }
  },
  arc: function(x, y, r, a0, a1, ccw) {
    x = +x, y = +y, r = +r;
    var dx = r * Math.cos(a0),
        dy = r * Math.sin(a0),
        x0 = x + dx,
        y0 = y + dy,
        cw = 1 ^ ccw,
        da = ccw ? a0 - a1 : a1 - a0;

    // Is the radius negative? Error.
    if (r < 0) throw new Error("negative radius: " + r);

    // Is this path empty? Move to (x0,y0).
    if (this._x1 === null) {
      this._ += "M" + x0 + "," + y0;
    }

    // Or, is (x0,y0) not coincident with the previous point? Line to (x0,y0).
    else if (Math.abs(this._x1 - x0) > epsilon$1 || Math.abs(this._y1 - y0) > epsilon$1) {
      this._ += "L" + x0 + "," + y0;
    }

    // Is this arc empty? We’re done.
    if (!r) return;

    // Does the angle go the wrong way? Flip the direction.
    if (da < 0) da = da % tau$1 + tau$1;

    // Is this a complete circle? Draw two arcs to complete the circle.
    if (da > tauEpsilon) {
      this._ += "A" + r + "," + r + ",0,1," + cw + "," + (x - dx) + "," + (y - dy) + "A" + r + "," + r + ",0,1," + cw + "," + (this._x1 = x0) + "," + (this._y1 = y0);
    }

    // Is this arc non-empty? Draw an arc!
    else if (da > epsilon$1) {
      this._ += "A" + r + "," + r + ",0," + (+(da >= pi$2)) + "," + cw + "," + (this._x1 = x + r * Math.cos(a1)) + "," + (this._y1 = y + r * Math.sin(a1));
    }
  },
  rect: function(x, y, w, h) {
    this._ += "M" + (this._x0 = this._x1 = +x) + "," + (this._y0 = this._y1 = +y) + "h" + (+w) + "v" + (+h) + "h" + (-w) + "Z";
  },
  toString: function() {
    return this._;
  }
};

var prefix = "$";

function Map() {}

Map.prototype = map.prototype = {
  constructor: Map,
  has: function(key) {
    return (prefix + key) in this;
  },
  get: function(key) {
    return this[prefix + key];
  },
  set: function(key, value) {
    this[prefix + key] = value;
    return this;
  },
  remove: function(key) {
    var property = prefix + key;
    return property in this && delete this[property];
  },
  clear: function() {
    for (var property in this) if (property[0] === prefix) delete this[property];
  },
  keys: function() {
    var keys = [];
    for (var property in this) if (property[0] === prefix) keys.push(property.slice(1));
    return keys;
  },
  values: function() {
    var values = [];
    for (var property in this) if (property[0] === prefix) values.push(this[property]);
    return values;
  },
  entries: function() {
    var entries = [];
    for (var property in this) if (property[0] === prefix) entries.push({key: property.slice(1), value: this[property]});
    return entries;
  },
  size: function() {
    var size = 0;
    for (var property in this) if (property[0] === prefix) ++size;
    return size;
  },
  empty: function() {
    for (var property in this) if (property[0] === prefix) return false;
    return true;
  },
  each: function(f) {
    for (var property in this) if (property[0] === prefix) f(this[property], property.slice(1), this);
  }
};

function map(object, f) {
  var map = new Map;

  // Copy constructor.
  if (object instanceof Map) object.each(function(value, key) { map.set(key, value); });

  // Index array by numeric index or specified key function.
  else if (Array.isArray(object)) {
    var i = -1,
        n = object.length,
        o;

    if (f == null) while (++i < n) map.set(i, object[i]);
    else while (++i < n) map.set(f(o = object[i], i, object), o);
  }

  // Convert object to map.
  else if (object) for (var key in object) map.set(key, object[key]);

  return map;
}

function nest() {
  var keys = [],
      sortKeys = [],
      sortValues,
      rollup,
      nest;

  function apply(array, depth, createResult, setResult) {
    if (depth >= keys.length) {
      if (sortValues != null) array.sort(sortValues);
      return rollup != null ? rollup(array) : array;
    }

    var i = -1,
        n = array.length,
        key = keys[depth++],
        keyValue,
        value,
        valuesByKey = map(),
        values,
        result = createResult();

    while (++i < n) {
      if (values = valuesByKey.get(keyValue = key(value = array[i]) + "")) {
        values.push(value);
      } else {
        valuesByKey.set(keyValue, [value]);
      }
    }

    valuesByKey.each(function(values, key) {
      setResult(result, key, apply(values, depth, createResult, setResult));
    });

    return result;
  }

  function entries(map, depth) {
    if (++depth > keys.length) return map;
    var array, sortKey = sortKeys[depth - 1];
    if (rollup != null && depth >= keys.length) array = map.entries();
    else array = [], map.each(function(v, k) { array.push({key: k, values: entries(v, depth)}); });
    return sortKey != null ? array.sort(function(a, b) { return sortKey(a.key, b.key); }) : array;
  }

  return nest = {
    object: function(array) { return apply(array, 0, createObject, setObject); },
    map: function(array) { return apply(array, 0, createMap, setMap); },
    entries: function(array) { return entries(apply(array, 0, createMap, setMap), 0); },
    key: function(d) { keys.push(d); return nest; },
    sortKeys: function(order) { sortKeys[keys.length - 1] = order; return nest; },
    sortValues: function(order) { sortValues = order; return nest; },
    rollup: function(f) { rollup = f; return nest; }
  };
}

function createObject() {
  return {};
}

function setObject(object, key, value) {
  object[key] = value;
}

function createMap() {
  return map();
}

function setMap(map, key, value) {
  map.set(key, value);
}

function Set() {}

var proto = map.prototype;

Set.prototype = set$2.prototype = {
  constructor: Set,
  has: proto.has,
  add: function(value) {
    value += "";
    this[prefix + value] = value;
    return this;
  },
  remove: proto.remove,
  clear: proto.clear,
  values: proto.keys,
  size: proto.size,
  empty: proto.empty,
  each: proto.each
};

function set$2(object, f) {
  var set = new Set;

  // Copy constructor.
  if (object instanceof Set) object.each(function(value) { set.add(value); });

  // Otherwise, assume it’s an array.
  else if (object) {
    var i = -1, n = object.length;
    if (f == null) while (++i < n) set.add(object[i]);
    else while (++i < n) set.add(f(object[i], i, object));
  }

  return set;
}

// TODO Optimize edge cases.

var EOL = {},
    EOF = {},
    QUOTE = 34,
    NEWLINE = 10,
    RETURN = 13;

function objectConverter(columns) {
  return new Function("d", "return {" + columns.map(function(name, i) {
    return JSON.stringify(name) + ": d[" + i + "]";
  }).join(",") + "}");
}

function customConverter(columns, f) {
  var object = objectConverter(columns);
  return function(row, i) {
    return f(object(row), i, columns);
  };
}

// Compute unique columns in order of discovery.
function inferColumns(rows) {
  var columnSet = Object.create(null),
      columns = [];

  rows.forEach(function(row) {
    for (var column in row) {
      if (!(column in columnSet)) {
        columns.push(columnSet[column] = column);
      }
    }
  });

  return columns;
}

function pad(value, width) {
  var s = value + "", length = s.length;
  return length < width ? new Array(width - length + 1).join(0) + s : s;
}

function formatYear(year) {
  return year < 0 ? "-" + pad(-year, 6)
    : year > 9999 ? "+" + pad(year, 6)
    : pad(year, 4);
}

function formatDate(date) {
  var hours = date.getUTCHours(),
      minutes = date.getUTCMinutes(),
      seconds = date.getUTCSeconds(),
      milliseconds = date.getUTCMilliseconds();
  return isNaN(date) ? "Invalid Date"
      : formatYear(date.getUTCFullYear()) + "-" + pad(date.getUTCMonth() + 1, 2) + "-" + pad(date.getUTCDate(), 2)
      + (milliseconds ? "T" + pad(hours, 2) + ":" + pad(minutes, 2) + ":" + pad(seconds, 2) + "." + pad(milliseconds, 3) + "Z"
      : seconds ? "T" + pad(hours, 2) + ":" + pad(minutes, 2) + ":" + pad(seconds, 2) + "Z"
      : minutes || hours ? "T" + pad(hours, 2) + ":" + pad(minutes, 2) + "Z"
      : "");
}

function dsvFormat(delimiter) {
  var reFormat = new RegExp("[\"" + delimiter + "\n\r]"),
      DELIMITER = delimiter.charCodeAt(0);

  function parse(text, f) {
    var convert, columns, rows = parseRows(text, function(row, i) {
      if (convert) return convert(row, i - 1);
      columns = row, convert = f ? customConverter(row, f) : objectConverter(row);
    });
    rows.columns = columns || [];
    return rows;
  }

  function parseRows(text, f) {
    var rows = [], // output rows
        N = text.length,
        I = 0, // current character index
        n = 0, // current line number
        t, // current token
        eof = N <= 0, // current token followed by EOF?
        eol = false; // current token followed by EOL?

    // Strip the trailing newline.
    if (text.charCodeAt(N - 1) === NEWLINE) --N;
    if (text.charCodeAt(N - 1) === RETURN) --N;

    function token() {
      if (eof) return EOF;
      if (eol) return eol = false, EOL;

      // Unescape quotes.
      var i, j = I, c;
      if (text.charCodeAt(j) === QUOTE) {
        while (I++ < N && text.charCodeAt(I) !== QUOTE || text.charCodeAt(++I) === QUOTE);
        if ((i = I) >= N) eof = true;
        else if ((c = text.charCodeAt(I++)) === NEWLINE) eol = true;
        else if (c === RETURN) { eol = true; if (text.charCodeAt(I) === NEWLINE) ++I; }
        return text.slice(j + 1, i - 1).replace(/""/g, "\"");
      }

      // Find next delimiter or newline.
      while (I < N) {
        if ((c = text.charCodeAt(i = I++)) === NEWLINE) eol = true;
        else if (c === RETURN) { eol = true; if (text.charCodeAt(I) === NEWLINE) ++I; }
        else if (c !== DELIMITER) continue;
        return text.slice(j, i);
      }

      // Return last token before EOF.
      return eof = true, text.slice(j, N);
    }

    while ((t = token()) !== EOF) {
      var row = [];
      while (t !== EOL && t !== EOF) row.push(t), t = token();
      if (f && (row = f(row, n++)) == null) continue;
      rows.push(row);
    }

    return rows;
  }

  function preformatBody(rows, columns) {
    return rows.map(function(row) {
      return columns.map(function(column) {
        return formatValue(row[column]);
      }).join(delimiter);
    });
  }

  function format(rows, columns) {
    if (columns == null) columns = inferColumns(rows);
    return [columns.map(formatValue).join(delimiter)].concat(preformatBody(rows, columns)).join("\n");
  }

  function formatBody(rows, columns) {
    if (columns == null) columns = inferColumns(rows);
    return preformatBody(rows, columns).join("\n");
  }

  function formatRows(rows) {
    return rows.map(formatRow).join("\n");
  }

  function formatRow(row) {
    return row.map(formatValue).join(delimiter);
  }

  function formatValue(value) {
    return value == null ? ""
        : value instanceof Date ? formatDate(value)
        : reFormat.test(value += "") ? "\"" + value.replace(/"/g, "\"\"") + "\""
        : value;
  }

  return {
    parse: parse,
    parseRows: parseRows,
    format: format,
    formatBody: formatBody,
    formatRows: formatRows
  };
}

var csv = dsvFormat(",");

var csvParse = csv.parse;

var tsv = dsvFormat("\t");

function responseText(response) {
  if (!response.ok) throw new Error(response.status + " " + response.statusText);
  return response.text();
}

function text$2(input, init) {
  return fetch(input, init).then(responseText);
}

function dsvParse(parse) {
  return function(input, init, row) {
    if (arguments.length === 2 && typeof init === "function") row = init, init = undefined;
    return text$2(input, init).then(function(response) {
      return parse(response, row);
    });
  };
}

var csv$1 = dsvParse(csvParse);

function tree_add(d) {
  var x = +this._x.call(null, d),
      y = +this._y.call(null, d);
  return add(this.cover(x, y), x, y, d);
}

function add(tree, x, y, d) {
  if (isNaN(x) || isNaN(y)) return tree; // ignore invalid points

  var parent,
      node = tree._root,
      leaf = {data: d},
      x0 = tree._x0,
      y0 = tree._y0,
      x1 = tree._x1,
      y1 = tree._y1,
      xm,
      ym,
      xp,
      yp,
      right,
      bottom,
      i,
      j;

  // If the tree is empty, initialize the root as a leaf.
  if (!node) return tree._root = leaf, tree;

  // Find the existing leaf for the new point, or add it.
  while (node.length) {
    if (right = x >= (xm = (x0 + x1) / 2)) x0 = xm; else x1 = xm;
    if (bottom = y >= (ym = (y0 + y1) / 2)) y0 = ym; else y1 = ym;
    if (parent = node, !(node = node[i = bottom << 1 | right])) return parent[i] = leaf, tree;
  }

  // Is the new point is exactly coincident with the existing point?
  xp = +tree._x.call(null, node.data);
  yp = +tree._y.call(null, node.data);
  if (x === xp && y === yp) return leaf.next = node, parent ? parent[i] = leaf : tree._root = leaf, tree;

  // Otherwise, split the leaf node until the old and new point are separated.
  do {
    parent = parent ? parent[i] = new Array(4) : tree._root = new Array(4);
    if (right = x >= (xm = (x0 + x1) / 2)) x0 = xm; else x1 = xm;
    if (bottom = y >= (ym = (y0 + y1) / 2)) y0 = ym; else y1 = ym;
  } while ((i = bottom << 1 | right) === (j = (yp >= ym) << 1 | (xp >= xm)));
  return parent[j] = node, parent[i] = leaf, tree;
}

function addAll(data) {
  var d, i, n = data.length,
      x,
      y,
      xz = new Array(n),
      yz = new Array(n),
      x0 = Infinity,
      y0 = Infinity,
      x1 = -Infinity,
      y1 = -Infinity;

  // Compute the points and their extent.
  for (i = 0; i < n; ++i) {
    if (isNaN(x = +this._x.call(null, d = data[i])) || isNaN(y = +this._y.call(null, d))) continue;
    xz[i] = x;
    yz[i] = y;
    if (x < x0) x0 = x;
    if (x > x1) x1 = x;
    if (y < y0) y0 = y;
    if (y > y1) y1 = y;
  }

  // If there were no (valid) points, abort.
  if (x0 > x1 || y0 > y1) return this;

  // Expand the tree to cover the new points.
  this.cover(x0, y0).cover(x1, y1);

  // Add the new points.
  for (i = 0; i < n; ++i) {
    add(this, xz[i], yz[i], data[i]);
  }

  return this;
}

function tree_cover(x, y) {
  if (isNaN(x = +x) || isNaN(y = +y)) return this; // ignore invalid points

  var x0 = this._x0,
      y0 = this._y0,
      x1 = this._x1,
      y1 = this._y1;

  // If the quadtree has no extent, initialize them.
  // Integer extent are necessary so that if we later double the extent,
  // the existing quadrant boundaries don’t change due to floating point error!
  if (isNaN(x0)) {
    x1 = (x0 = Math.floor(x)) + 1;
    y1 = (y0 = Math.floor(y)) + 1;
  }

  // Otherwise, double repeatedly to cover.
  else {
    var z = x1 - x0,
        node = this._root,
        parent,
        i;

    while (x0 > x || x >= x1 || y0 > y || y >= y1) {
      i = (y < y0) << 1 | (x < x0);
      parent = new Array(4), parent[i] = node, node = parent, z *= 2;
      switch (i) {
        case 0: x1 = x0 + z, y1 = y0 + z; break;
        case 1: x0 = x1 - z, y1 = y0 + z; break;
        case 2: x1 = x0 + z, y0 = y1 - z; break;
        case 3: x0 = x1 - z, y0 = y1 - z; break;
      }
    }

    if (this._root && this._root.length) this._root = node;
  }

  this._x0 = x0;
  this._y0 = y0;
  this._x1 = x1;
  this._y1 = y1;
  return this;
}

function tree_data() {
  var data = [];
  this.visit(function(node) {
    if (!node.length) do data.push(node.data); while (node = node.next)
  });
  return data;
}

function tree_extent(_) {
  return arguments.length
      ? this.cover(+_[0][0], +_[0][1]).cover(+_[1][0], +_[1][1])
      : isNaN(this._x0) ? undefined : [[this._x0, this._y0], [this._x1, this._y1]];
}

function Quad(node, x0, y0, x1, y1) {
  this.node = node;
  this.x0 = x0;
  this.y0 = y0;
  this.x1 = x1;
  this.y1 = y1;
}

function tree_find(x, y, radius) {
  var data,
      x0 = this._x0,
      y0 = this._y0,
      x1,
      y1,
      x2,
      y2,
      x3 = this._x1,
      y3 = this._y1,
      quads = [],
      node = this._root,
      q,
      i;

  if (node) quads.push(new Quad(node, x0, y0, x3, y3));
  if (radius == null) radius = Infinity;
  else {
    x0 = x - radius, y0 = y - radius;
    x3 = x + radius, y3 = y + radius;
    radius *= radius;
  }

  while (q = quads.pop()) {

    // Stop searching if this quadrant can’t contain a closer node.
    if (!(node = q.node)
        || (x1 = q.x0) > x3
        || (y1 = q.y0) > y3
        || (x2 = q.x1) < x0
        || (y2 = q.y1) < y0) continue;

    // Bisect the current quadrant.
    if (node.length) {
      var xm = (x1 + x2) / 2,
          ym = (y1 + y2) / 2;

      quads.push(
        new Quad(node[3], xm, ym, x2, y2),
        new Quad(node[2], x1, ym, xm, y2),
        new Quad(node[1], xm, y1, x2, ym),
        new Quad(node[0], x1, y1, xm, ym)
      );

      // Visit the closest quadrant first.
      if (i = (y >= ym) << 1 | (x >= xm)) {
        q = quads[quads.length - 1];
        quads[quads.length - 1] = quads[quads.length - 1 - i];
        quads[quads.length - 1 - i] = q;
      }
    }

    // Visit this point. (Visiting coincident points isn’t necessary!)
    else {
      var dx = x - +this._x.call(null, node.data),
          dy = y - +this._y.call(null, node.data),
          d2 = dx * dx + dy * dy;
      if (d2 < radius) {
        var d = Math.sqrt(radius = d2);
        x0 = x - d, y0 = y - d;
        x3 = x + d, y3 = y + d;
        data = node.data;
      }
    }
  }

  return data;
}

function tree_remove(d) {
  if (isNaN(x = +this._x.call(null, d)) || isNaN(y = +this._y.call(null, d))) return this; // ignore invalid points

  var parent,
      node = this._root,
      retainer,
      previous,
      next,
      x0 = this._x0,
      y0 = this._y0,
      x1 = this._x1,
      y1 = this._y1,
      x,
      y,
      xm,
      ym,
      right,
      bottom,
      i,
      j;

  // If the tree is empty, initialize the root as a leaf.
  if (!node) return this;

  // Find the leaf node for the point.
  // While descending, also retain the deepest parent with a non-removed sibling.
  if (node.length) while (true) {
    if (right = x >= (xm = (x0 + x1) / 2)) x0 = xm; else x1 = xm;
    if (bottom = y >= (ym = (y0 + y1) / 2)) y0 = ym; else y1 = ym;
    if (!(parent = node, node = node[i = bottom << 1 | right])) return this;
    if (!node.length) break;
    if (parent[(i + 1) & 3] || parent[(i + 2) & 3] || parent[(i + 3) & 3]) retainer = parent, j = i;
  }

  // Find the point to remove.
  while (node.data !== d) if (!(previous = node, node = node.next)) return this;
  if (next = node.next) delete node.next;

  // If there are multiple coincident points, remove just the point.
  if (previous) return (next ? previous.next = next : delete previous.next), this;

  // If this is the root point, remove it.
  if (!parent) return this._root = next, this;

  // Remove this leaf.
  next ? parent[i] = next : delete parent[i];

  // If the parent now contains exactly one leaf, collapse superfluous parents.
  if ((node = parent[0] || parent[1] || parent[2] || parent[3])
      && node === (parent[3] || parent[2] || parent[1] || parent[0])
      && !node.length) {
    if (retainer) retainer[j] = node;
    else this._root = node;
  }

  return this;
}

function removeAll(data) {
  for (var i = 0, n = data.length; i < n; ++i) this.remove(data[i]);
  return this;
}

function tree_root() {
  return this._root;
}

function tree_size() {
  var size = 0;
  this.visit(function(node) {
    if (!node.length) do ++size; while (node = node.next)
  });
  return size;
}

function tree_visit(callback) {
  var quads = [], q, node = this._root, child, x0, y0, x1, y1;
  if (node) quads.push(new Quad(node, this._x0, this._y0, this._x1, this._y1));
  while (q = quads.pop()) {
    if (!callback(node = q.node, x0 = q.x0, y0 = q.y0, x1 = q.x1, y1 = q.y1) && node.length) {
      var xm = (x0 + x1) / 2, ym = (y0 + y1) / 2;
      if (child = node[3]) quads.push(new Quad(child, xm, ym, x1, y1));
      if (child = node[2]) quads.push(new Quad(child, x0, ym, xm, y1));
      if (child = node[1]) quads.push(new Quad(child, xm, y0, x1, ym));
      if (child = node[0]) quads.push(new Quad(child, x0, y0, xm, ym));
    }
  }
  return this;
}

function tree_visitAfter(callback) {
  var quads = [], next = [], q;
  if (this._root) quads.push(new Quad(this._root, this._x0, this._y0, this._x1, this._y1));
  while (q = quads.pop()) {
    var node = q.node;
    if (node.length) {
      var child, x0 = q.x0, y0 = q.y0, x1 = q.x1, y1 = q.y1, xm = (x0 + x1) / 2, ym = (y0 + y1) / 2;
      if (child = node[0]) quads.push(new Quad(child, x0, y0, xm, ym));
      if (child = node[1]) quads.push(new Quad(child, xm, y0, x1, ym));
      if (child = node[2]) quads.push(new Quad(child, x0, ym, xm, y1));
      if (child = node[3]) quads.push(new Quad(child, xm, ym, x1, y1));
    }
    next.push(q);
  }
  while (q = next.pop()) {
    callback(q.node, q.x0, q.y0, q.x1, q.y1);
  }
  return this;
}

function defaultX(d) {
  return d[0];
}

function tree_x(_) {
  return arguments.length ? (this._x = _, this) : this._x;
}

function defaultY(d) {
  return d[1];
}

function tree_y(_) {
  return arguments.length ? (this._y = _, this) : this._y;
}

function quadtree(nodes, x, y) {
  var tree = new Quadtree(x == null ? defaultX : x, y == null ? defaultY : y, NaN, NaN, NaN, NaN);
  return nodes == null ? tree : tree.addAll(nodes);
}

function Quadtree(x, y, x0, y0, x1, y1) {
  this._x = x;
  this._y = y;
  this._x0 = x0;
  this._y0 = y0;
  this._x1 = x1;
  this._y1 = y1;
  this._root = undefined;
}

function leaf_copy(leaf) {
  var copy = {data: leaf.data}, next = copy;
  while (leaf = leaf.next) next = next.next = {data: leaf.data};
  return copy;
}

var treeProto = quadtree.prototype = Quadtree.prototype;

treeProto.copy = function() {
  var copy = new Quadtree(this._x, this._y, this._x0, this._y0, this._x1, this._y1),
      node = this._root,
      nodes,
      child;

  if (!node) return copy;

  if (!node.length) return copy._root = leaf_copy(node), copy;

  nodes = [{source: node, target: copy._root = new Array(4)}];
  while (node = nodes.pop()) {
    for (var i = 0; i < 4; ++i) {
      if (child = node.source[i]) {
        if (child.length) nodes.push({source: child, target: node.target[i] = new Array(4)});
        else node.target[i] = leaf_copy(child);
      }
    }
  }

  return copy;
};

treeProto.add = tree_add;
treeProto.addAll = addAll;
treeProto.cover = tree_cover;
treeProto.data = tree_data;
treeProto.extent = tree_extent;
treeProto.find = tree_find;
treeProto.remove = tree_remove;
treeProto.removeAll = removeAll;
treeProto.root = tree_root;
treeProto.size = tree_size;
treeProto.visit = tree_visit;
treeProto.visitAfter = tree_visitAfter;
treeProto.x = tree_x;
treeProto.y = tree_y;

var initialAngle = Math.PI * (3 - Math.sqrt(5));

// Computes the decimal coefficient and exponent of the specified number x with
// significant digits p, where x is positive and p is in [1, 21] or undefined.
// For example, formatDecimal(1.23) returns ["123", 0].
function formatDecimal(x, p) {
  if ((i = (x = p ? x.toExponential(p - 1) : x.toExponential()).indexOf("e")) < 0) return null; // NaN, ±Infinity
  var i, coefficient = x.slice(0, i);

  // The string returned by toExponential either has the form \d\.\d+e[-+]\d+
  // (e.g., 1.2e+3) or the form \de[-+]\d+ (e.g., 1e+3).
  return [
    coefficient.length > 1 ? coefficient[0] + coefficient.slice(2) : coefficient,
    +x.slice(i + 1)
  ];
}

function exponent(x) {
  return x = formatDecimal(Math.abs(x)), x ? x[1] : NaN;
}

function formatGroup(grouping, thousands) {
  return function(value, width) {
    var i = value.length,
        t = [],
        j = 0,
        g = grouping[0],
        length = 0;

    while (i > 0 && g > 0) {
      if (length + g + 1 > width) g = Math.max(1, width - length);
      t.push(value.substring(i -= g, i + g));
      if ((length += g + 1) > width) break;
      g = grouping[j = (j + 1) % grouping.length];
    }

    return t.reverse().join(thousands);
  };
}

function formatNumerals(numerals) {
  return function(value) {
    return value.replace(/[0-9]/g, function(i) {
      return numerals[+i];
    });
  };
}

// [[fill]align][sign][symbol][0][width][,][.precision][~][type]
var re = /^(?:(.)?([<>=^]))?([+\-( ])?([$#])?(0)?(\d+)?(,)?(\.\d+)?(~)?([a-z%])?$/i;

function formatSpecifier(specifier) {
  return new FormatSpecifier(specifier);
}

formatSpecifier.prototype = FormatSpecifier.prototype; // instanceof

function FormatSpecifier(specifier) {
  if (!(match = re.exec(specifier))) throw new Error("invalid format: " + specifier);
  var match;
  this.fill = match[1] || " ";
  this.align = match[2] || ">";
  this.sign = match[3] || "-";
  this.symbol = match[4] || "";
  this.zero = !!match[5];
  this.width = match[6] && +match[6];
  this.comma = !!match[7];
  this.precision = match[8] && +match[8].slice(1);
  this.trim = !!match[9];
  this.type = match[10] || "";
}

FormatSpecifier.prototype.toString = function() {
  return this.fill
      + this.align
      + this.sign
      + this.symbol
      + (this.zero ? "0" : "")
      + (this.width == null ? "" : Math.max(1, this.width | 0))
      + (this.comma ? "," : "")
      + (this.precision == null ? "" : "." + Math.max(0, this.precision | 0))
      + (this.trim ? "~" : "")
      + this.type;
};

// Trims insignificant zeros, e.g., replaces 1.2000k with 1.2k.
function formatTrim(s) {
  out: for (var n = s.length, i = 1, i0 = -1, i1; i < n; ++i) {
    switch (s[i]) {
      case ".": i0 = i1 = i; break;
      case "0": if (i0 === 0) i0 = i; i1 = i; break;
      default: if (i0 > 0) { if (!+s[i]) break out; i0 = 0; } break;
    }
  }
  return i0 > 0 ? s.slice(0, i0) + s.slice(i1 + 1) : s;
}

var prefixExponent;

function formatPrefixAuto(x, p) {
  var d = formatDecimal(x, p);
  if (!d) return x + "";
  var coefficient = d[0],
      exponent = d[1],
      i = exponent - (prefixExponent = Math.max(-8, Math.min(8, Math.floor(exponent / 3))) * 3) + 1,
      n = coefficient.length;
  return i === n ? coefficient
      : i > n ? coefficient + new Array(i - n + 1).join("0")
      : i > 0 ? coefficient.slice(0, i) + "." + coefficient.slice(i)
      : "0." + new Array(1 - i).join("0") + formatDecimal(x, Math.max(0, p + i - 1))[0]; // less than 1y!
}

function formatRounded(x, p) {
  var d = formatDecimal(x, p);
  if (!d) return x + "";
  var coefficient = d[0],
      exponent = d[1];
  return exponent < 0 ? "0." + new Array(-exponent).join("0") + coefficient
      : coefficient.length > exponent + 1 ? coefficient.slice(0, exponent + 1) + "." + coefficient.slice(exponent + 1)
      : coefficient + new Array(exponent - coefficient.length + 2).join("0");
}

var formatTypes = {
  "%": function(x, p) { return (x * 100).toFixed(p); },
  "b": function(x) { return Math.round(x).toString(2); },
  "c": function(x) { return x + ""; },
  "d": function(x) { return Math.round(x).toString(10); },
  "e": function(x, p) { return x.toExponential(p); },
  "f": function(x, p) { return x.toFixed(p); },
  "g": function(x, p) { return x.toPrecision(p); },
  "o": function(x) { return Math.round(x).toString(8); },
  "p": function(x, p) { return formatRounded(x * 100, p); },
  "r": formatRounded,
  "s": formatPrefixAuto,
  "X": function(x) { return Math.round(x).toString(16).toUpperCase(); },
  "x": function(x) { return Math.round(x).toString(16); }
};

function identity$2(x) {
  return x;
}

var prefixes = ["y","z","a","f","p","n","\xB5","m","","k","M","G","T","P","E","Z","Y"];

function formatLocale(locale) {
  var group = locale.grouping && locale.thousands ? formatGroup(locale.grouping, locale.thousands) : identity$2,
      currency = locale.currency,
      decimal = locale.decimal,
      numerals = locale.numerals ? formatNumerals(locale.numerals) : identity$2,
      percent = locale.percent || "%";

  function newFormat(specifier) {
    specifier = formatSpecifier(specifier);

    var fill = specifier.fill,
        align = specifier.align,
        sign = specifier.sign,
        symbol = specifier.symbol,
        zero = specifier.zero,
        width = specifier.width,
        comma = specifier.comma,
        precision = specifier.precision,
        trim = specifier.trim,
        type = specifier.type;

    // The "n" type is an alias for ",g".
    if (type === "n") comma = true, type = "g";

    // The "" type, and any invalid type, is an alias for ".12~g".
    else if (!formatTypes[type]) precision == null && (precision = 12), trim = true, type = "g";

    // If zero fill is specified, padding goes after sign and before digits.
    if (zero || (fill === "0" && align === "=")) zero = true, fill = "0", align = "=";

    // Compute the prefix and suffix.
    // For SI-prefix, the suffix is lazily computed.
    var prefix = symbol === "$" ? currency[0] : symbol === "#" && /[boxX]/.test(type) ? "0" + type.toLowerCase() : "",
        suffix = symbol === "$" ? currency[1] : /[%p]/.test(type) ? percent : "";

    // What format function should we use?
    // Is this an integer type?
    // Can this type generate exponential notation?
    var formatType = formatTypes[type],
        maybeSuffix = /[defgprs%]/.test(type);

    // Set the default precision if not specified,
    // or clamp the specified precision to the supported range.
    // For significant precision, it must be in [1, 21].
    // For fixed precision, it must be in [0, 20].
    precision = precision == null ? 6
        : /[gprs]/.test(type) ? Math.max(1, Math.min(21, precision))
        : Math.max(0, Math.min(20, precision));

    function format(value) {
      var valuePrefix = prefix,
          valueSuffix = suffix,
          i, n, c;

      if (type === "c") {
        valueSuffix = formatType(value) + valueSuffix;
        value = "";
      } else {
        value = +value;

        // Perform the initial formatting.
        var valueNegative = value < 0;
        value = formatType(Math.abs(value), precision);

        // Trim insignificant zeros.
        if (trim) value = formatTrim(value);

        // If a negative value rounds to zero during formatting, treat as positive.
        if (valueNegative && +value === 0) valueNegative = false;

        // Compute the prefix and suffix.
        valuePrefix = (valueNegative ? (sign === "(" ? sign : "-") : sign === "-" || sign === "(" ? "" : sign) + valuePrefix;
        valueSuffix = (type === "s" ? prefixes[8 + prefixExponent / 3] : "") + valueSuffix + (valueNegative && sign === "(" ? ")" : "");

        // Break the formatted value into the integer “value” part that can be
        // grouped, and fractional or exponential “suffix” part that is not.
        if (maybeSuffix) {
          i = -1, n = value.length;
          while (++i < n) {
            if (c = value.charCodeAt(i), 48 > c || c > 57) {
              valueSuffix = (c === 46 ? decimal + value.slice(i + 1) : value.slice(i)) + valueSuffix;
              value = value.slice(0, i);
              break;
            }
          }
        }
      }

      // If the fill character is not "0", grouping is applied before padding.
      if (comma && !zero) value = group(value, Infinity);

      // Compute the padding.
      var length = valuePrefix.length + value.length + valueSuffix.length,
          padding = length < width ? new Array(width - length + 1).join(fill) : "";

      // If the fill character is "0", grouping is applied after padding.
      if (comma && zero) value = group(padding + value, padding.length ? width - valueSuffix.length : Infinity), padding = "";

      // Reconstruct the final output based on the desired alignment.
      switch (align) {
        case "<": value = valuePrefix + value + valueSuffix + padding; break;
        case "=": value = valuePrefix + padding + value + valueSuffix; break;
        case "^": value = padding.slice(0, length = padding.length >> 1) + valuePrefix + value + valueSuffix + padding.slice(length); break;
        default: value = padding + valuePrefix + value + valueSuffix; break;
      }

      return numerals(value);
    }

    format.toString = function() {
      return specifier + "";
    };

    return format;
  }

  function formatPrefix(specifier, value) {
    var f = newFormat((specifier = formatSpecifier(specifier), specifier.type = "f", specifier)),
        e = Math.max(-8, Math.min(8, Math.floor(exponent(value) / 3))) * 3,
        k = Math.pow(10, -e),
        prefix = prefixes[8 + e / 3];
    return function(value) {
      return f(k * value) + prefix;
    };
  }

  return {
    format: newFormat,
    formatPrefix: formatPrefix
  };
}

var locale;
var format;
var formatPrefix;

defaultLocale({
  decimal: ".",
  thousands: ",",
  grouping: [3],
  currency: ["$", ""]
});

function defaultLocale(definition) {
  locale = formatLocale(definition);
  format = locale.format;
  formatPrefix = locale.formatPrefix;
  return locale;
}

function precisionFixed(step) {
  return Math.max(0, -exponent(Math.abs(step)));
}

function precisionPrefix(step, value) {
  return Math.max(0, Math.max(-8, Math.min(8, Math.floor(exponent(value) / 3))) * 3 - exponent(Math.abs(step)));
}

function precisionRound(step, max) {
  step = Math.abs(step), max = Math.abs(max) - step;
  return Math.max(0, exponent(max) - exponent(step)) + 1;
}

// Adds floating point numbers with twice the normal precision.
// Reference: J. R. Shewchuk, Adaptive Precision Floating-Point Arithmetic and
// Fast Robust Geometric Predicates, Discrete & Computational Geometry 18(3)
// 305–363 (1997).
// Code adapted from GeographicLib by Charles F. F. Karney,
// http://geographiclib.sourceforge.net/

function adder() {
  return new Adder;
}

function Adder() {
  this.reset();
}

Adder.prototype = {
  constructor: Adder,
  reset: function() {
    this.s = // rounded value
    this.t = 0; // exact error
  },
  add: function(y) {
    add$1(temp, y, this.t);
    add$1(this, temp.s, this.s);
    if (this.s) this.t += temp.t;
    else this.s = temp.t;
  },
  valueOf: function() {
    return this.s;
  }
};

var temp = new Adder;

function add$1(adder, a, b) {
  var x = adder.s = a + b,
      bv = x - a,
      av = x - bv;
  adder.t = (a - av) + (b - bv);
}

var pi$3 = Math.PI;

var areaRingSum = adder();

var areaSum = adder();

var deltaSum = adder();

var sum = adder();

var lengthSum = adder();

var areaSum$1 = adder(),
    areaRingSum$1 = adder();

var lengthSum$1 = adder();

// Returns the 2D cross product of AB and AC vectors, i.e., the z-component of

function initRange(domain, range) {
  switch (arguments.length) {
    case 0: break;
    case 1: this.range(domain); break;
    default: this.range(range).domain(domain); break;
  }
  return this;
}

var array$1 = Array.prototype;

var map$1 = array$1.map;
var slice$1 = array$1.slice;

function constant$2(x) {
  return function() {
    return x;
  };
}

function number$1(x) {
  return +x;
}

var unit = [0, 1];

function identity$3(x) {
  return x;
}

function normalize(a, b) {
  return (b -= (a = +a))
      ? function(x) { return (x - a) / b; }
      : constant$2(isNaN(b) ? NaN : 0.5);
}

function clamper(domain) {
  var a = domain[0], b = domain[domain.length - 1], t;
  if (a > b) t = a, a = b, b = t;
  return function(x) { return Math.max(a, Math.min(b, x)); };
}

// normalize(a, b)(x) takes a domain value x in [a,b] and returns the corresponding parameter t in [0,1].
// interpolate(a, b)(t) takes a parameter t in [0,1] and returns the corresponding range value x in [a,b].
function bimap(domain, range, interpolate) {
  var d0 = domain[0], d1 = domain[1], r0 = range[0], r1 = range[1];
  if (d1 < d0) d0 = normalize(d1, d0), r0 = interpolate(r1, r0);
  else d0 = normalize(d0, d1), r0 = interpolate(r0, r1);
  return function(x) { return r0(d0(x)); };
}

function polymap(domain, range, interpolate) {
  var j = Math.min(domain.length, range.length) - 1,
      d = new Array(j),
      r = new Array(j),
      i = -1;

  // Reverse descending domains.
  if (domain[j] < domain[0]) {
    domain = domain.slice().reverse();
    range = range.slice().reverse();
  }

  while (++i < j) {
    d[i] = normalize(domain[i], domain[i + 1]);
    r[i] = interpolate(range[i], range[i + 1]);
  }

  return function(x) {
    var i = bisectRight(domain, x, 1, j) - 1;
    return r[i](d[i](x));
  };
}

function copy(source, target) {
  return target
      .domain(source.domain())
      .range(source.range())
      .interpolate(source.interpolate())
      .clamp(source.clamp())
      .unknown(source.unknown());
}

function transformer() {
  var domain = unit,
      range = unit,
      interpolate = interpolateValue,
      transform,
      untransform,
      unknown,
      clamp = identity$3,
      piecewise,
      output,
      input;

  function rescale() {
    piecewise = Math.min(domain.length, range.length) > 2 ? polymap : bimap;
    output = input = null;
    return scale;
  }

  function scale(x) {
    return isNaN(x = +x) ? unknown : (output || (output = piecewise(domain.map(transform), range, interpolate)))(transform(clamp(x)));
  }

  scale.invert = function(y) {
    return clamp(untransform((input || (input = piecewise(range, domain.map(transform), interpolateNumber)))(y)));
  };

  scale.domain = function(_) {
    return arguments.length ? (domain = map$1.call(_, number$1), clamp === identity$3 || (clamp = clamper(domain)), rescale()) : domain.slice();
  };

  scale.range = function(_) {
    return arguments.length ? (range = slice$1.call(_), rescale()) : range.slice();
  };

  scale.rangeRound = function(_) {
    return range = slice$1.call(_), interpolate = interpolateRound, rescale();
  };

  scale.clamp = function(_) {
    return arguments.length ? (clamp = _ ? clamper(domain) : identity$3, scale) : clamp !== identity$3;
  };

  scale.interpolate = function(_) {
    return arguments.length ? (interpolate = _, rescale()) : interpolate;
  };

  scale.unknown = function(_) {
    return arguments.length ? (unknown = _, scale) : unknown;
  };

  return function(t, u) {
    transform = t, untransform = u;
    return rescale();
  };
}

function continuous(transform, untransform) {
  return transformer()(transform, untransform);
}

function tickFormat(start, stop, count, specifier) {
  var step = tickStep(start, stop, count),
      precision;
  specifier = formatSpecifier(specifier == null ? ",f" : specifier);
  switch (specifier.type) {
    case "s": {
      var value = Math.max(Math.abs(start), Math.abs(stop));
      if (specifier.precision == null && !isNaN(precision = precisionPrefix(step, value))) specifier.precision = precision;
      return formatPrefix(specifier, value);
    }
    case "":
    case "e":
    case "g":
    case "p":
    case "r": {
      if (specifier.precision == null && !isNaN(precision = precisionRound(step, Math.max(Math.abs(start), Math.abs(stop))))) specifier.precision = precision - (specifier.type === "e");
      break;
    }
    case "f":
    case "%": {
      if (specifier.precision == null && !isNaN(precision = precisionFixed(step))) specifier.precision = precision - (specifier.type === "%") * 2;
      break;
    }
  }
  return format(specifier);
}

function linearish(scale) {
  var domain = scale.domain;

  scale.ticks = function(count) {
    var d = domain();
    return ticks(d[0], d[d.length - 1], count == null ? 10 : count);
  };

  scale.tickFormat = function(count, specifier) {
    var d = domain();
    return tickFormat(d[0], d[d.length - 1], count == null ? 10 : count, specifier);
  };

  scale.nice = function(count) {
    if (count == null) count = 10;

    var d = domain(),
        i0 = 0,
        i1 = d.length - 1,
        start = d[i0],
        stop = d[i1],
        step;

    if (stop < start) {
      step = start, start = stop, stop = step;
      step = i0, i0 = i1, i1 = step;
    }

    step = tickIncrement(start, stop, count);

    if (step > 0) {
      start = Math.floor(start / step) * step;
      stop = Math.ceil(stop / step) * step;
      step = tickIncrement(start, stop, count);
    } else if (step < 0) {
      start = Math.ceil(start * step) / step;
      stop = Math.floor(stop * step) / step;
      step = tickIncrement(start, stop, count);
    }

    if (step > 0) {
      d[i0] = Math.floor(start / step) * step;
      d[i1] = Math.ceil(stop / step) * step;
      domain(d);
    } else if (step < 0) {
      d[i0] = Math.ceil(start * step) / step;
      d[i1] = Math.floor(stop * step) / step;
      domain(d);
    }

    return scale;
  };

  return scale;
}

function linear$1() {
  var scale = continuous(identity$3, identity$3);

  scale.copy = function() {
    return copy(scale, linear$1());
  };

  initRange.apply(scale, arguments);

  return linearish(scale);
}

var t0$1 = new Date,
    t1$1 = new Date;

function newInterval(floori, offseti, count, field) {

  function interval(date) {
    return floori(date = new Date(+date)), date;
  }

  interval.floor = interval;

  interval.ceil = function(date) {
    return floori(date = new Date(date - 1)), offseti(date, 1), floori(date), date;
  };

  interval.round = function(date) {
    var d0 = interval(date),
        d1 = interval.ceil(date);
    return date - d0 < d1 - date ? d0 : d1;
  };

  interval.offset = function(date, step) {
    return offseti(date = new Date(+date), step == null ? 1 : Math.floor(step)), date;
  };

  interval.range = function(start, stop, step) {
    var range = [], previous;
    start = interval.ceil(start);
    step = step == null ? 1 : Math.floor(step);
    if (!(start < stop) || !(step > 0)) return range; // also handles Invalid Date
    do range.push(previous = new Date(+start)), offseti(start, step), floori(start);
    while (previous < start && start < stop);
    return range;
  };

  interval.filter = function(test) {
    return newInterval(function(date) {
      if (date >= date) while (floori(date), !test(date)) date.setTime(date - 1);
    }, function(date, step) {
      if (date >= date) {
        if (step < 0) while (++step <= 0) {
          while (offseti(date, -1), !test(date)) {} // eslint-disable-line no-empty
        } else while (--step >= 0) {
          while (offseti(date, +1), !test(date)) {} // eslint-disable-line no-empty
        }
      }
    });
  };

  if (count) {
    interval.count = function(start, end) {
      t0$1.setTime(+start), t1$1.setTime(+end);
      floori(t0$1), floori(t1$1);
      return Math.floor(count(t0$1, t1$1));
    };

    interval.every = function(step) {
      step = Math.floor(step);
      return !isFinite(step) || !(step > 0) ? null
          : !(step > 1) ? interval
          : interval.filter(field
              ? function(d) { return field(d) % step === 0; }
              : function(d) { return interval.count(0, d) % step === 0; });
    };
  }

  return interval;
}

var millisecond = newInterval(function() {
  // noop
}, function(date, step) {
  date.setTime(+date + step);
}, function(start, end) {
  return end - start;
});

// An optimized implementation for this simple case.
millisecond.every = function(k) {
  k = Math.floor(k);
  if (!isFinite(k) || !(k > 0)) return null;
  if (!(k > 1)) return millisecond;
  return newInterval(function(date) {
    date.setTime(Math.floor(date / k) * k);
  }, function(date, step) {
    date.setTime(+date + step * k);
  }, function(start, end) {
    return (end - start) / k;
  });
};

var durationSecond = 1e3;
var durationMinute = 6e4;
var durationHour = 36e5;
var durationDay = 864e5;
var durationWeek = 6048e5;

var second = newInterval(function(date) {
  date.setTime(date - date.getMilliseconds());
}, function(date, step) {
  date.setTime(+date + step * durationSecond);
}, function(start, end) {
  return (end - start) / durationSecond;
}, function(date) {
  return date.getUTCSeconds();
});

var minute = newInterval(function(date) {
  date.setTime(date - date.getMilliseconds() - date.getSeconds() * durationSecond);
}, function(date, step) {
  date.setTime(+date + step * durationMinute);
}, function(start, end) {
  return (end - start) / durationMinute;
}, function(date) {
  return date.getMinutes();
});

var hour = newInterval(function(date) {
  date.setTime(date - date.getMilliseconds() - date.getSeconds() * durationSecond - date.getMinutes() * durationMinute);
}, function(date, step) {
  date.setTime(+date + step * durationHour);
}, function(start, end) {
  return (end - start) / durationHour;
}, function(date) {
  return date.getHours();
});

var day = newInterval(function(date) {
  date.setHours(0, 0, 0, 0);
}, function(date, step) {
  date.setDate(date.getDate() + step);
}, function(start, end) {
  return (end - start - (end.getTimezoneOffset() - start.getTimezoneOffset()) * durationMinute) / durationDay;
}, function(date) {
  return date.getDate() - 1;
});

function weekday(i) {
  return newInterval(function(date) {
    date.setDate(date.getDate() - (date.getDay() + 7 - i) % 7);
    date.setHours(0, 0, 0, 0);
  }, function(date, step) {
    date.setDate(date.getDate() + step * 7);
  }, function(start, end) {
    return (end - start - (end.getTimezoneOffset() - start.getTimezoneOffset()) * durationMinute) / durationWeek;
  });
}

var sunday = weekday(0);
var monday = weekday(1);
var tuesday = weekday(2);
var wednesday = weekday(3);
var thursday = weekday(4);
var friday = weekday(5);
var saturday = weekday(6);

var month = newInterval(function(date) {
  date.setDate(1);
  date.setHours(0, 0, 0, 0);
}, function(date, step) {
  date.setMonth(date.getMonth() + step);
}, function(start, end) {
  return end.getMonth() - start.getMonth() + (end.getFullYear() - start.getFullYear()) * 12;
}, function(date) {
  return date.getMonth();
});

var year = newInterval(function(date) {
  date.setMonth(0, 1);
  date.setHours(0, 0, 0, 0);
}, function(date, step) {
  date.setFullYear(date.getFullYear() + step);
}, function(start, end) {
  return end.getFullYear() - start.getFullYear();
}, function(date) {
  return date.getFullYear();
});

// An optimized implementation for this simple case.
year.every = function(k) {
  return !isFinite(k = Math.floor(k)) || !(k > 0) ? null : newInterval(function(date) {
    date.setFullYear(Math.floor(date.getFullYear() / k) * k);
    date.setMonth(0, 1);
    date.setHours(0, 0, 0, 0);
  }, function(date, step) {
    date.setFullYear(date.getFullYear() + step * k);
  });
};

var utcMinute = newInterval(function(date) {
  date.setUTCSeconds(0, 0);
}, function(date, step) {
  date.setTime(+date + step * durationMinute);
}, function(start, end) {
  return (end - start) / durationMinute;
}, function(date) {
  return date.getUTCMinutes();
});

var utcHour = newInterval(function(date) {
  date.setUTCMinutes(0, 0, 0);
}, function(date, step) {
  date.setTime(+date + step * durationHour);
}, function(start, end) {
  return (end - start) / durationHour;
}, function(date) {
  return date.getUTCHours();
});

var utcDay = newInterval(function(date) {
  date.setUTCHours(0, 0, 0, 0);
}, function(date, step) {
  date.setUTCDate(date.getUTCDate() + step);
}, function(start, end) {
  return (end - start) / durationDay;
}, function(date) {
  return date.getUTCDate() - 1;
});

function utcWeekday(i) {
  return newInterval(function(date) {
    date.setUTCDate(date.getUTCDate() - (date.getUTCDay() + 7 - i) % 7);
    date.setUTCHours(0, 0, 0, 0);
  }, function(date, step) {
    date.setUTCDate(date.getUTCDate() + step * 7);
  }, function(start, end) {
    return (end - start) / durationWeek;
  });
}

var utcSunday = utcWeekday(0);
var utcMonday = utcWeekday(1);
var utcTuesday = utcWeekday(2);
var utcWednesday = utcWeekday(3);
var utcThursday = utcWeekday(4);
var utcFriday = utcWeekday(5);
var utcSaturday = utcWeekday(6);

var utcMonth = newInterval(function(date) {
  date.setUTCDate(1);
  date.setUTCHours(0, 0, 0, 0);
}, function(date, step) {
  date.setUTCMonth(date.getUTCMonth() + step);
}, function(start, end) {
  return end.getUTCMonth() - start.getUTCMonth() + (end.getUTCFullYear() - start.getUTCFullYear()) * 12;
}, function(date) {
  return date.getUTCMonth();
});

var utcYear = newInterval(function(date) {
  date.setUTCMonth(0, 1);
  date.setUTCHours(0, 0, 0, 0);
}, function(date, step) {
  date.setUTCFullYear(date.getUTCFullYear() + step);
}, function(start, end) {
  return end.getUTCFullYear() - start.getUTCFullYear();
}, function(date) {
  return date.getUTCFullYear();
});

// An optimized implementation for this simple case.
utcYear.every = function(k) {
  return !isFinite(k = Math.floor(k)) || !(k > 0) ? null : newInterval(function(date) {
    date.setUTCFullYear(Math.floor(date.getUTCFullYear() / k) * k);
    date.setUTCMonth(0, 1);
    date.setUTCHours(0, 0, 0, 0);
  }, function(date, step) {
    date.setUTCFullYear(date.getUTCFullYear() + step * k);
  });
};

function localDate(d) {
  if (0 <= d.y && d.y < 100) {
    var date = new Date(-1, d.m, d.d, d.H, d.M, d.S, d.L);
    date.setFullYear(d.y);
    return date;
  }
  return new Date(d.y, d.m, d.d, d.H, d.M, d.S, d.L);
}

function utcDate(d) {
  if (0 <= d.y && d.y < 100) {
    var date = new Date(Date.UTC(-1, d.m, d.d, d.H, d.M, d.S, d.L));
    date.setUTCFullYear(d.y);
    return date;
  }
  return new Date(Date.UTC(d.y, d.m, d.d, d.H, d.M, d.S, d.L));
}

function newYear(y) {
  return {y: y, m: 0, d: 1, H: 0, M: 0, S: 0, L: 0};
}

function formatLocale$1(locale) {
  var locale_dateTime = locale.dateTime,
      locale_date = locale.date,
      locale_time = locale.time,
      locale_periods = locale.periods,
      locale_weekdays = locale.days,
      locale_shortWeekdays = locale.shortDays,
      locale_months = locale.months,
      locale_shortMonths = locale.shortMonths;

  var periodRe = formatRe(locale_periods),
      periodLookup = formatLookup(locale_periods),
      weekdayRe = formatRe(locale_weekdays),
      weekdayLookup = formatLookup(locale_weekdays),
      shortWeekdayRe = formatRe(locale_shortWeekdays),
      shortWeekdayLookup = formatLookup(locale_shortWeekdays),
      monthRe = formatRe(locale_months),
      monthLookup = formatLookup(locale_months),
      shortMonthRe = formatRe(locale_shortMonths),
      shortMonthLookup = formatLookup(locale_shortMonths);

  var formats = {
    "a": formatShortWeekday,
    "A": formatWeekday,
    "b": formatShortMonth,
    "B": formatMonth,
    "c": null,
    "d": formatDayOfMonth,
    "e": formatDayOfMonth,
    "f": formatMicroseconds,
    "H": formatHour24,
    "I": formatHour12,
    "j": formatDayOfYear,
    "L": formatMilliseconds,
    "m": formatMonthNumber,
    "M": formatMinutes,
    "p": formatPeriod,
    "Q": formatUnixTimestamp,
    "s": formatUnixTimestampSeconds,
    "S": formatSeconds,
    "u": formatWeekdayNumberMonday,
    "U": formatWeekNumberSunday,
    "V": formatWeekNumberISO,
    "w": formatWeekdayNumberSunday,
    "W": formatWeekNumberMonday,
    "x": null,
    "X": null,
    "y": formatYear$1,
    "Y": formatFullYear,
    "Z": formatZone,
    "%": formatLiteralPercent
  };

  var utcFormats = {
    "a": formatUTCShortWeekday,
    "A": formatUTCWeekday,
    "b": formatUTCShortMonth,
    "B": formatUTCMonth,
    "c": null,
    "d": formatUTCDayOfMonth,
    "e": formatUTCDayOfMonth,
    "f": formatUTCMicroseconds,
    "H": formatUTCHour24,
    "I": formatUTCHour12,
    "j": formatUTCDayOfYear,
    "L": formatUTCMilliseconds,
    "m": formatUTCMonthNumber,
    "M": formatUTCMinutes,
    "p": formatUTCPeriod,
    "Q": formatUnixTimestamp,
    "s": formatUnixTimestampSeconds,
    "S": formatUTCSeconds,
    "u": formatUTCWeekdayNumberMonday,
    "U": formatUTCWeekNumberSunday,
    "V": formatUTCWeekNumberISO,
    "w": formatUTCWeekdayNumberSunday,
    "W": formatUTCWeekNumberMonday,
    "x": null,
    "X": null,
    "y": formatUTCYear,
    "Y": formatUTCFullYear,
    "Z": formatUTCZone,
    "%": formatLiteralPercent
  };

  var parses = {
    "a": parseShortWeekday,
    "A": parseWeekday,
    "b": parseShortMonth,
    "B": parseMonth,
    "c": parseLocaleDateTime,
    "d": parseDayOfMonth,
    "e": parseDayOfMonth,
    "f": parseMicroseconds,
    "H": parseHour24,
    "I": parseHour24,
    "j": parseDayOfYear,
    "L": parseMilliseconds,
    "m": parseMonthNumber,
    "M": parseMinutes,
    "p": parsePeriod,
    "Q": parseUnixTimestamp,
    "s": parseUnixTimestampSeconds,
    "S": parseSeconds,
    "u": parseWeekdayNumberMonday,
    "U": parseWeekNumberSunday,
    "V": parseWeekNumberISO,
    "w": parseWeekdayNumberSunday,
    "W": parseWeekNumberMonday,
    "x": parseLocaleDate,
    "X": parseLocaleTime,
    "y": parseYear,
    "Y": parseFullYear,
    "Z": parseZone,
    "%": parseLiteralPercent
  };

  // These recursive directive definitions must be deferred.
  formats.x = newFormat(locale_date, formats);
  formats.X = newFormat(locale_time, formats);
  formats.c = newFormat(locale_dateTime, formats);
  utcFormats.x = newFormat(locale_date, utcFormats);
  utcFormats.X = newFormat(locale_time, utcFormats);
  utcFormats.c = newFormat(locale_dateTime, utcFormats);

  function newFormat(specifier, formats) {
    return function(date) {
      var string = [],
          i = -1,
          j = 0,
          n = specifier.length,
          c,
          pad,
          format;

      if (!(date instanceof Date)) date = new Date(+date);

      while (++i < n) {
        if (specifier.charCodeAt(i) === 37) {
          string.push(specifier.slice(j, i));
          if ((pad = pads[c = specifier.charAt(++i)]) != null) c = specifier.charAt(++i);
          else pad = c === "e" ? " " : "0";
          if (format = formats[c]) c = format(date, pad);
          string.push(c);
          j = i + 1;
        }
      }

      string.push(specifier.slice(j, i));
      return string.join("");
    };
  }

  function newParse(specifier, newDate) {
    return function(string) {
      var d = newYear(1900),
          i = parseSpecifier(d, specifier, string += "", 0),
          week, day$1;
      if (i != string.length) return null;

      // If a UNIX timestamp is specified, return it.
      if ("Q" in d) return new Date(d.Q);

      // The am-pm flag is 0 for AM, and 1 for PM.
      if ("p" in d) d.H = d.H % 12 + d.p * 12;

      // Convert day-of-week and week-of-year to day-of-year.
      if ("V" in d) {
        if (d.V < 1 || d.V > 53) return null;
        if (!("w" in d)) d.w = 1;
        if ("Z" in d) {
          week = utcDate(newYear(d.y)), day$1 = week.getUTCDay();
          week = day$1 > 4 || day$1 === 0 ? utcMonday.ceil(week) : utcMonday(week);
          week = utcDay.offset(week, (d.V - 1) * 7);
          d.y = week.getUTCFullYear();
          d.m = week.getUTCMonth();
          d.d = week.getUTCDate() + (d.w + 6) % 7;
        } else {
          week = newDate(newYear(d.y)), day$1 = week.getDay();
          week = day$1 > 4 || day$1 === 0 ? monday.ceil(week) : monday(week);
          week = day.offset(week, (d.V - 1) * 7);
          d.y = week.getFullYear();
          d.m = week.getMonth();
          d.d = week.getDate() + (d.w + 6) % 7;
        }
      } else if ("W" in d || "U" in d) {
        if (!("w" in d)) d.w = "u" in d ? d.u % 7 : "W" in d ? 1 : 0;
        day$1 = "Z" in d ? utcDate(newYear(d.y)).getUTCDay() : newDate(newYear(d.y)).getDay();
        d.m = 0;
        d.d = "W" in d ? (d.w + 6) % 7 + d.W * 7 - (day$1 + 5) % 7 : d.w + d.U * 7 - (day$1 + 6) % 7;
      }

      // If a time zone is specified, all fields are interpreted as UTC and then
      // offset according to the specified time zone.
      if ("Z" in d) {
        d.H += d.Z / 100 | 0;
        d.M += d.Z % 100;
        return utcDate(d);
      }

      // Otherwise, all fields are in local time.
      return newDate(d);
    };
  }

  function parseSpecifier(d, specifier, string, j) {
    var i = 0,
        n = specifier.length,
        m = string.length,
        c,
        parse;

    while (i < n) {
      if (j >= m) return -1;
      c = specifier.charCodeAt(i++);
      if (c === 37) {
        c = specifier.charAt(i++);
        parse = parses[c in pads ? specifier.charAt(i++) : c];
        if (!parse || ((j = parse(d, string, j)) < 0)) return -1;
      } else if (c != string.charCodeAt(j++)) {
        return -1;
      }
    }

    return j;
  }

  function parsePeriod(d, string, i) {
    var n = periodRe.exec(string.slice(i));
    return n ? (d.p = periodLookup[n[0].toLowerCase()], i + n[0].length) : -1;
  }

  function parseShortWeekday(d, string, i) {
    var n = shortWeekdayRe.exec(string.slice(i));
    return n ? (d.w = shortWeekdayLookup[n[0].toLowerCase()], i + n[0].length) : -1;
  }

  function parseWeekday(d, string, i) {
    var n = weekdayRe.exec(string.slice(i));
    return n ? (d.w = weekdayLookup[n[0].toLowerCase()], i + n[0].length) : -1;
  }

  function parseShortMonth(d, string, i) {
    var n = shortMonthRe.exec(string.slice(i));
    return n ? (d.m = shortMonthLookup[n[0].toLowerCase()], i + n[0].length) : -1;
  }

  function parseMonth(d, string, i) {
    var n = monthRe.exec(string.slice(i));
    return n ? (d.m = monthLookup[n[0].toLowerCase()], i + n[0].length) : -1;
  }

  function parseLocaleDateTime(d, string, i) {
    return parseSpecifier(d, locale_dateTime, string, i);
  }

  function parseLocaleDate(d, string, i) {
    return parseSpecifier(d, locale_date, string, i);
  }

  function parseLocaleTime(d, string, i) {
    return parseSpecifier(d, locale_time, string, i);
  }

  function formatShortWeekday(d) {
    return locale_shortWeekdays[d.getDay()];
  }

  function formatWeekday(d) {
    return locale_weekdays[d.getDay()];
  }

  function formatShortMonth(d) {
    return locale_shortMonths[d.getMonth()];
  }

  function formatMonth(d) {
    return locale_months[d.getMonth()];
  }

  function formatPeriod(d) {
    return locale_periods[+(d.getHours() >= 12)];
  }

  function formatUTCShortWeekday(d) {
    return locale_shortWeekdays[d.getUTCDay()];
  }

  function formatUTCWeekday(d) {
    return locale_weekdays[d.getUTCDay()];
  }

  function formatUTCShortMonth(d) {
    return locale_shortMonths[d.getUTCMonth()];
  }

  function formatUTCMonth(d) {
    return locale_months[d.getUTCMonth()];
  }

  function formatUTCPeriod(d) {
    return locale_periods[+(d.getUTCHours() >= 12)];
  }

  return {
    format: function(specifier) {
      var f = newFormat(specifier += "", formats);
      f.toString = function() { return specifier; };
      return f;
    },
    parse: function(specifier) {
      var p = newParse(specifier += "", localDate);
      p.toString = function() { return specifier; };
      return p;
    },
    utcFormat: function(specifier) {
      var f = newFormat(specifier += "", utcFormats);
      f.toString = function() { return specifier; };
      return f;
    },
    utcParse: function(specifier) {
      var p = newParse(specifier, utcDate);
      p.toString = function() { return specifier; };
      return p;
    }
  };
}

var pads = {"-": "", "_": " ", "0": "0"},
    numberRe = /^\s*\d+/, // note: ignores next directive
    percentRe = /^%/,
    requoteRe = /[\\^$*+?|[\]().{}]/g;

function pad$1(value, fill, width) {
  var sign = value < 0 ? "-" : "",
      string = (sign ? -value : value) + "",
      length = string.length;
  return sign + (length < width ? new Array(width - length + 1).join(fill) + string : string);
}

function requote(s) {
  return s.replace(requoteRe, "\\$&");
}

function formatRe(names) {
  return new RegExp("^(?:" + names.map(requote).join("|") + ")", "i");
}

function formatLookup(names) {
  var map = {}, i = -1, n = names.length;
  while (++i < n) map[names[i].toLowerCase()] = i;
  return map;
}

function parseWeekdayNumberSunday(d, string, i) {
  var n = numberRe.exec(string.slice(i, i + 1));
  return n ? (d.w = +n[0], i + n[0].length) : -1;
}

function parseWeekdayNumberMonday(d, string, i) {
  var n = numberRe.exec(string.slice(i, i + 1));
  return n ? (d.u = +n[0], i + n[0].length) : -1;
}

function parseWeekNumberSunday(d, string, i) {
  var n = numberRe.exec(string.slice(i, i + 2));
  return n ? (d.U = +n[0], i + n[0].length) : -1;
}

function parseWeekNumberISO(d, string, i) {
  var n = numberRe.exec(string.slice(i, i + 2));
  return n ? (d.V = +n[0], i + n[0].length) : -1;
}

function parseWeekNumberMonday(d, string, i) {
  var n = numberRe.exec(string.slice(i, i + 2));
  return n ? (d.W = +n[0], i + n[0].length) : -1;
}

function parseFullYear(d, string, i) {
  var n = numberRe.exec(string.slice(i, i + 4));
  return n ? (d.y = +n[0], i + n[0].length) : -1;
}

function parseYear(d, string, i) {
  var n = numberRe.exec(string.slice(i, i + 2));
  return n ? (d.y = +n[0] + (+n[0] > 68 ? 1900 : 2000), i + n[0].length) : -1;
}

function parseZone(d, string, i) {
  var n = /^(Z)|([+-]\d\d)(?::?(\d\d))?/.exec(string.slice(i, i + 6));
  return n ? (d.Z = n[1] ? 0 : -(n[2] + (n[3] || "00")), i + n[0].length) : -1;
}

function parseMonthNumber(d, string, i) {
  var n = numberRe.exec(string.slice(i, i + 2));
  return n ? (d.m = n[0] - 1, i + n[0].length) : -1;
}

function parseDayOfMonth(d, string, i) {
  var n = numberRe.exec(string.slice(i, i + 2));
  return n ? (d.d = +n[0], i + n[0].length) : -1;
}

function parseDayOfYear(d, string, i) {
  var n = numberRe.exec(string.slice(i, i + 3));
  return n ? (d.m = 0, d.d = +n[0], i + n[0].length) : -1;
}

function parseHour24(d, string, i) {
  var n = numberRe.exec(string.slice(i, i + 2));
  return n ? (d.H = +n[0], i + n[0].length) : -1;
}

function parseMinutes(d, string, i) {
  var n = numberRe.exec(string.slice(i, i + 2));
  return n ? (d.M = +n[0], i + n[0].length) : -1;
}

function parseSeconds(d, string, i) {
  var n = numberRe.exec(string.slice(i, i + 2));
  return n ? (d.S = +n[0], i + n[0].length) : -1;
}

function parseMilliseconds(d, string, i) {
  var n = numberRe.exec(string.slice(i, i + 3));
  return n ? (d.L = +n[0], i + n[0].length) : -1;
}

function parseMicroseconds(d, string, i) {
  var n = numberRe.exec(string.slice(i, i + 6));
  return n ? (d.L = Math.floor(n[0] / 1000), i + n[0].length) : -1;
}

function parseLiteralPercent(d, string, i) {
  var n = percentRe.exec(string.slice(i, i + 1));
  return n ? i + n[0].length : -1;
}

function parseUnixTimestamp(d, string, i) {
  var n = numberRe.exec(string.slice(i));
  return n ? (d.Q = +n[0], i + n[0].length) : -1;
}

function parseUnixTimestampSeconds(d, string, i) {
  var n = numberRe.exec(string.slice(i));
  return n ? (d.Q = (+n[0]) * 1000, i + n[0].length) : -1;
}

function formatDayOfMonth(d, p) {
  return pad$1(d.getDate(), p, 2);
}

function formatHour24(d, p) {
  return pad$1(d.getHours(), p, 2);
}

function formatHour12(d, p) {
  return pad$1(d.getHours() % 12 || 12, p, 2);
}

function formatDayOfYear(d, p) {
  return pad$1(1 + day.count(year(d), d), p, 3);
}

function formatMilliseconds(d, p) {
  return pad$1(d.getMilliseconds(), p, 3);
}

function formatMicroseconds(d, p) {
  return formatMilliseconds(d, p) + "000";
}

function formatMonthNumber(d, p) {
  return pad$1(d.getMonth() + 1, p, 2);
}

function formatMinutes(d, p) {
  return pad$1(d.getMinutes(), p, 2);
}

function formatSeconds(d, p) {
  return pad$1(d.getSeconds(), p, 2);
}

function formatWeekdayNumberMonday(d) {
  var day = d.getDay();
  return day === 0 ? 7 : day;
}

function formatWeekNumberSunday(d, p) {
  return pad$1(sunday.count(year(d), d), p, 2);
}

function formatWeekNumberISO(d, p) {
  var day = d.getDay();
  d = (day >= 4 || day === 0) ? thursday(d) : thursday.ceil(d);
  return pad$1(thursday.count(year(d), d) + (year(d).getDay() === 4), p, 2);
}

function formatWeekdayNumberSunday(d) {
  return d.getDay();
}

function formatWeekNumberMonday(d, p) {
  return pad$1(monday.count(year(d), d), p, 2);
}

function formatYear$1(d, p) {
  return pad$1(d.getFullYear() % 100, p, 2);
}

function formatFullYear(d, p) {
  return pad$1(d.getFullYear() % 10000, p, 4);
}

function formatZone(d) {
  var z = d.getTimezoneOffset();
  return (z > 0 ? "-" : (z *= -1, "+"))
      + pad$1(z / 60 | 0, "0", 2)
      + pad$1(z % 60, "0", 2);
}

function formatUTCDayOfMonth(d, p) {
  return pad$1(d.getUTCDate(), p, 2);
}

function formatUTCHour24(d, p) {
  return pad$1(d.getUTCHours(), p, 2);
}

function formatUTCHour12(d, p) {
  return pad$1(d.getUTCHours() % 12 || 12, p, 2);
}

function formatUTCDayOfYear(d, p) {
  return pad$1(1 + utcDay.count(utcYear(d), d), p, 3);
}

function formatUTCMilliseconds(d, p) {
  return pad$1(d.getUTCMilliseconds(), p, 3);
}

function formatUTCMicroseconds(d, p) {
  return formatUTCMilliseconds(d, p) + "000";
}

function formatUTCMonthNumber(d, p) {
  return pad$1(d.getUTCMonth() + 1, p, 2);
}

function formatUTCMinutes(d, p) {
  return pad$1(d.getUTCMinutes(), p, 2);
}

function formatUTCSeconds(d, p) {
  return pad$1(d.getUTCSeconds(), p, 2);
}

function formatUTCWeekdayNumberMonday(d) {
  var dow = d.getUTCDay();
  return dow === 0 ? 7 : dow;
}

function formatUTCWeekNumberSunday(d, p) {
  return pad$1(utcSunday.count(utcYear(d), d), p, 2);
}

function formatUTCWeekNumberISO(d, p) {
  var day = d.getUTCDay();
  d = (day >= 4 || day === 0) ? utcThursday(d) : utcThursday.ceil(d);
  return pad$1(utcThursday.count(utcYear(d), d) + (utcYear(d).getUTCDay() === 4), p, 2);
}

function formatUTCWeekdayNumberSunday(d) {
  return d.getUTCDay();
}

function formatUTCWeekNumberMonday(d, p) {
  return pad$1(utcMonday.count(utcYear(d), d), p, 2);
}

function formatUTCYear(d, p) {
  return pad$1(d.getUTCFullYear() % 100, p, 2);
}

function formatUTCFullYear(d, p) {
  return pad$1(d.getUTCFullYear() % 10000, p, 4);
}

function formatUTCZone() {
  return "+0000";
}

function formatLiteralPercent() {
  return "%";
}

function formatUnixTimestamp(d) {
  return +d;
}

function formatUnixTimestampSeconds(d) {
  return Math.floor(+d / 1000);
}

var locale$1;
var timeFormat;
var timeParse;
var utcFormat;
var utcParse;

defaultLocale$1({
  dateTime: "%x, %X",
  date: "%-m/%-d/%Y",
  time: "%-I:%M:%S %p",
  periods: ["AM", "PM"],
  days: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
  shortDays: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
  months: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
  shortMonths: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
});

function defaultLocale$1(definition) {
  locale$1 = formatLocale$1(definition);
  timeFormat = locale$1.format;
  timeParse = locale$1.parse;
  utcFormat = locale$1.utcFormat;
  utcParse = locale$1.utcParse;
  return locale$1;
}

var isoSpecifier = "%Y-%m-%dT%H:%M:%S.%LZ";

function formatIsoNative(date) {
  return date.toISOString();
}

var formatIso = Date.prototype.toISOString
    ? formatIsoNative
    : utcFormat(isoSpecifier);

function parseIsoNative(string) {
  var date = new Date(string);
  return isNaN(date) ? null : date;
}

var parseIso = +new Date("2000-01-01T00:00:00.000Z")
    ? parseIsoNative
    : utcParse(isoSpecifier);

function colors$1(specifier) {
  var n = specifier.length / 6 | 0, colors = new Array(n), i = 0;
  while (i < n) colors[i] = "#" + specifier.slice(i * 6, ++i * 6);
  return colors;
}

colors$1("1f77b4ff7f0e2ca02cd627289467bd8c564be377c27f7f7fbcbd2217becf");

colors$1("7fc97fbeaed4fdc086ffff99386cb0f0027fbf5b17666666");

colors$1("1b9e77d95f027570b3e7298a66a61ee6ab02a6761d666666");

colors$1("a6cee31f78b4b2df8a33a02cfb9a99e31a1cfdbf6fff7f00cab2d66a3d9affff99b15928");

colors$1("fbb4aeb3cde3ccebc5decbe4fed9a6ffffcce5d8bdfddaecf2f2f2");

colors$1("b3e2cdfdcdaccbd5e8f4cae4e6f5c9fff2aef1e2cccccccc");

colors$1("e41a1c377eb84daf4a984ea3ff7f00ffff33a65628f781bf999999");

colors$1("66c2a5fc8d628da0cbe78ac3a6d854ffd92fe5c494b3b3b3");

colors$1("8dd3c7ffffb3bebadafb807280b1d3fdb462b3de69fccde5d9d9d9bc80bdccebc5ffed6f");

function ramp(scheme) {
  return rgbBasis(scheme[scheme.length - 1]);
}

var scheme = new Array(3).concat(
  "d8b365f5f5f55ab4ac",
  "a6611adfc27d80cdc1018571",
  "a6611adfc27df5f5f580cdc1018571",
  "8c510ad8b365f6e8c3c7eae55ab4ac01665e",
  "8c510ad8b365f6e8c3f5f5f5c7eae55ab4ac01665e",
  "8c510abf812ddfc27df6e8c3c7eae580cdc135978f01665e",
  "8c510abf812ddfc27df6e8c3f5f5f5c7eae580cdc135978f01665e",
  "5430058c510abf812ddfc27df6e8c3c7eae580cdc135978f01665e003c30",
  "5430058c510abf812ddfc27df6e8c3f5f5f5c7eae580cdc135978f01665e003c30"
).map(colors$1);

ramp(scheme);

var scheme$1 = new Array(3).concat(
  "af8dc3f7f7f77fbf7b",
  "7b3294c2a5cfa6dba0008837",
  "7b3294c2a5cff7f7f7a6dba0008837",
  "762a83af8dc3e7d4e8d9f0d37fbf7b1b7837",
  "762a83af8dc3e7d4e8f7f7f7d9f0d37fbf7b1b7837",
  "762a839970abc2a5cfe7d4e8d9f0d3a6dba05aae611b7837",
  "762a839970abc2a5cfe7d4e8f7f7f7d9f0d3a6dba05aae611b7837",
  "40004b762a839970abc2a5cfe7d4e8d9f0d3a6dba05aae611b783700441b",
  "40004b762a839970abc2a5cfe7d4e8f7f7f7d9f0d3a6dba05aae611b783700441b"
).map(colors$1);

ramp(scheme$1);

var scheme$2 = new Array(3).concat(
  "e9a3c9f7f7f7a1d76a",
  "d01c8bf1b6dab8e1864dac26",
  "d01c8bf1b6daf7f7f7b8e1864dac26",
  "c51b7de9a3c9fde0efe6f5d0a1d76a4d9221",
  "c51b7de9a3c9fde0eff7f7f7e6f5d0a1d76a4d9221",
  "c51b7dde77aef1b6dafde0efe6f5d0b8e1867fbc414d9221",
  "c51b7dde77aef1b6dafde0eff7f7f7e6f5d0b8e1867fbc414d9221",
  "8e0152c51b7dde77aef1b6dafde0efe6f5d0b8e1867fbc414d9221276419",
  "8e0152c51b7dde77aef1b6dafde0eff7f7f7e6f5d0b8e1867fbc414d9221276419"
).map(colors$1);

ramp(scheme$2);

var scheme$3 = new Array(3).concat(
  "998ec3f7f7f7f1a340",
  "5e3c99b2abd2fdb863e66101",
  "5e3c99b2abd2f7f7f7fdb863e66101",
  "542788998ec3d8daebfee0b6f1a340b35806",
  "542788998ec3d8daebf7f7f7fee0b6f1a340b35806",
  "5427888073acb2abd2d8daebfee0b6fdb863e08214b35806",
  "5427888073acb2abd2d8daebf7f7f7fee0b6fdb863e08214b35806",
  "2d004b5427888073acb2abd2d8daebfee0b6fdb863e08214b358067f3b08",
  "2d004b5427888073acb2abd2d8daebf7f7f7fee0b6fdb863e08214b358067f3b08"
).map(colors$1);

ramp(scheme$3);

var scheme$4 = new Array(3).concat(
  "ef8a62f7f7f767a9cf",
  "ca0020f4a58292c5de0571b0",
  "ca0020f4a582f7f7f792c5de0571b0",
  "b2182bef8a62fddbc7d1e5f067a9cf2166ac",
  "b2182bef8a62fddbc7f7f7f7d1e5f067a9cf2166ac",
  "b2182bd6604df4a582fddbc7d1e5f092c5de4393c32166ac",
  "b2182bd6604df4a582fddbc7f7f7f7d1e5f092c5de4393c32166ac",
  "67001fb2182bd6604df4a582fddbc7d1e5f092c5de4393c32166ac053061",
  "67001fb2182bd6604df4a582fddbc7f7f7f7d1e5f092c5de4393c32166ac053061"
).map(colors$1);

ramp(scheme$4);

var scheme$5 = new Array(3).concat(
  "ef8a62ffffff999999",
  "ca0020f4a582bababa404040",
  "ca0020f4a582ffffffbababa404040",
  "b2182bef8a62fddbc7e0e0e09999994d4d4d",
  "b2182bef8a62fddbc7ffffffe0e0e09999994d4d4d",
  "b2182bd6604df4a582fddbc7e0e0e0bababa8787874d4d4d",
  "b2182bd6604df4a582fddbc7ffffffe0e0e0bababa8787874d4d4d",
  "67001fb2182bd6604df4a582fddbc7e0e0e0bababa8787874d4d4d1a1a1a",
  "67001fb2182bd6604df4a582fddbc7ffffffe0e0e0bababa8787874d4d4d1a1a1a"
).map(colors$1);

ramp(scheme$5);

var scheme$6 = new Array(3).concat(
  "fc8d59ffffbf91bfdb",
  "d7191cfdae61abd9e92c7bb6",
  "d7191cfdae61ffffbfabd9e92c7bb6",
  "d73027fc8d59fee090e0f3f891bfdb4575b4",
  "d73027fc8d59fee090ffffbfe0f3f891bfdb4575b4",
  "d73027f46d43fdae61fee090e0f3f8abd9e974add14575b4",
  "d73027f46d43fdae61fee090ffffbfe0f3f8abd9e974add14575b4",
  "a50026d73027f46d43fdae61fee090e0f3f8abd9e974add14575b4313695",
  "a50026d73027f46d43fdae61fee090ffffbfe0f3f8abd9e974add14575b4313695"
).map(colors$1);

ramp(scheme$6);

var scheme$7 = new Array(3).concat(
  "fc8d59ffffbf91cf60",
  "d7191cfdae61a6d96a1a9641",
  "d7191cfdae61ffffbfa6d96a1a9641",
  "d73027fc8d59fee08bd9ef8b91cf601a9850",
  "d73027fc8d59fee08bffffbfd9ef8b91cf601a9850",
  "d73027f46d43fdae61fee08bd9ef8ba6d96a66bd631a9850",
  "d73027f46d43fdae61fee08bffffbfd9ef8ba6d96a66bd631a9850",
  "a50026d73027f46d43fdae61fee08bd9ef8ba6d96a66bd631a9850006837",
  "a50026d73027f46d43fdae61fee08bffffbfd9ef8ba6d96a66bd631a9850006837"
).map(colors$1);

ramp(scheme$7);

var scheme$8 = new Array(3).concat(
  "fc8d59ffffbf99d594",
  "d7191cfdae61abdda42b83ba",
  "d7191cfdae61ffffbfabdda42b83ba",
  "d53e4ffc8d59fee08be6f59899d5943288bd",
  "d53e4ffc8d59fee08bffffbfe6f59899d5943288bd",
  "d53e4ff46d43fdae61fee08be6f598abdda466c2a53288bd",
  "d53e4ff46d43fdae61fee08bffffbfe6f598abdda466c2a53288bd",
  "9e0142d53e4ff46d43fdae61fee08be6f598abdda466c2a53288bd5e4fa2",
  "9e0142d53e4ff46d43fdae61fee08bffffbfe6f598abdda466c2a53288bd5e4fa2"
).map(colors$1);

ramp(scheme$8);

var scheme$9 = new Array(3).concat(
  "e5f5f999d8c92ca25f",
  "edf8fbb2e2e266c2a4238b45",
  "edf8fbb2e2e266c2a42ca25f006d2c",
  "edf8fbccece699d8c966c2a42ca25f006d2c",
  "edf8fbccece699d8c966c2a441ae76238b45005824",
  "f7fcfde5f5f9ccece699d8c966c2a441ae76238b45005824",
  "f7fcfde5f5f9ccece699d8c966c2a441ae76238b45006d2c00441b"
).map(colors$1);

ramp(scheme$9);

var scheme$a = new Array(3).concat(
  "e0ecf49ebcda8856a7",
  "edf8fbb3cde38c96c688419d",
  "edf8fbb3cde38c96c68856a7810f7c",
  "edf8fbbfd3e69ebcda8c96c68856a7810f7c",
  "edf8fbbfd3e69ebcda8c96c68c6bb188419d6e016b",
  "f7fcfde0ecf4bfd3e69ebcda8c96c68c6bb188419d6e016b",
  "f7fcfde0ecf4bfd3e69ebcda8c96c68c6bb188419d810f7c4d004b"
).map(colors$1);

ramp(scheme$a);

var scheme$b = new Array(3).concat(
  "e0f3dba8ddb543a2ca",
  "f0f9e8bae4bc7bccc42b8cbe",
  "f0f9e8bae4bc7bccc443a2ca0868ac",
  "f0f9e8ccebc5a8ddb57bccc443a2ca0868ac",
  "f0f9e8ccebc5a8ddb57bccc44eb3d32b8cbe08589e",
  "f7fcf0e0f3dbccebc5a8ddb57bccc44eb3d32b8cbe08589e",
  "f7fcf0e0f3dbccebc5a8ddb57bccc44eb3d32b8cbe0868ac084081"
).map(colors$1);

ramp(scheme$b);

var scheme$c = new Array(3).concat(
  "fee8c8fdbb84e34a33",
  "fef0d9fdcc8afc8d59d7301f",
  "fef0d9fdcc8afc8d59e34a33b30000",
  "fef0d9fdd49efdbb84fc8d59e34a33b30000",
  "fef0d9fdd49efdbb84fc8d59ef6548d7301f990000",
  "fff7ecfee8c8fdd49efdbb84fc8d59ef6548d7301f990000",
  "fff7ecfee8c8fdd49efdbb84fc8d59ef6548d7301fb300007f0000"
).map(colors$1);

ramp(scheme$c);

var scheme$d = new Array(3).concat(
  "ece2f0a6bddb1c9099",
  "f6eff7bdc9e167a9cf02818a",
  "f6eff7bdc9e167a9cf1c9099016c59",
  "f6eff7d0d1e6a6bddb67a9cf1c9099016c59",
  "f6eff7d0d1e6a6bddb67a9cf3690c002818a016450",
  "fff7fbece2f0d0d1e6a6bddb67a9cf3690c002818a016450",
  "fff7fbece2f0d0d1e6a6bddb67a9cf3690c002818a016c59014636"
).map(colors$1);

ramp(scheme$d);

var scheme$e = new Array(3).concat(
  "ece7f2a6bddb2b8cbe",
  "f1eef6bdc9e174a9cf0570b0",
  "f1eef6bdc9e174a9cf2b8cbe045a8d",
  "f1eef6d0d1e6a6bddb74a9cf2b8cbe045a8d",
  "f1eef6d0d1e6a6bddb74a9cf3690c00570b0034e7b",
  "fff7fbece7f2d0d1e6a6bddb74a9cf3690c00570b0034e7b",
  "fff7fbece7f2d0d1e6a6bddb74a9cf3690c00570b0045a8d023858"
).map(colors$1);

ramp(scheme$e);

var scheme$f = new Array(3).concat(
  "e7e1efc994c7dd1c77",
  "f1eef6d7b5d8df65b0ce1256",
  "f1eef6d7b5d8df65b0dd1c77980043",
  "f1eef6d4b9dac994c7df65b0dd1c77980043",
  "f1eef6d4b9dac994c7df65b0e7298ace125691003f",
  "f7f4f9e7e1efd4b9dac994c7df65b0e7298ace125691003f",
  "f7f4f9e7e1efd4b9dac994c7df65b0e7298ace125698004367001f"
).map(colors$1);

ramp(scheme$f);

var scheme$g = new Array(3).concat(
  "fde0ddfa9fb5c51b8a",
  "feebe2fbb4b9f768a1ae017e",
  "feebe2fbb4b9f768a1c51b8a7a0177",
  "feebe2fcc5c0fa9fb5f768a1c51b8a7a0177",
  "feebe2fcc5c0fa9fb5f768a1dd3497ae017e7a0177",
  "fff7f3fde0ddfcc5c0fa9fb5f768a1dd3497ae017e7a0177",
  "fff7f3fde0ddfcc5c0fa9fb5f768a1dd3497ae017e7a017749006a"
).map(colors$1);

ramp(scheme$g);

var scheme$h = new Array(3).concat(
  "edf8b17fcdbb2c7fb8",
  "ffffcca1dab441b6c4225ea8",
  "ffffcca1dab441b6c42c7fb8253494",
  "ffffccc7e9b47fcdbb41b6c42c7fb8253494",
  "ffffccc7e9b47fcdbb41b6c41d91c0225ea80c2c84",
  "ffffd9edf8b1c7e9b47fcdbb41b6c41d91c0225ea80c2c84",
  "ffffd9edf8b1c7e9b47fcdbb41b6c41d91c0225ea8253494081d58"
).map(colors$1);

ramp(scheme$h);

var scheme$i = new Array(3).concat(
  "f7fcb9addd8e31a354",
  "ffffccc2e69978c679238443",
  "ffffccc2e69978c67931a354006837",
  "ffffccd9f0a3addd8e78c67931a354006837",
  "ffffccd9f0a3addd8e78c67941ab5d238443005a32",
  "ffffe5f7fcb9d9f0a3addd8e78c67941ab5d238443005a32",
  "ffffe5f7fcb9d9f0a3addd8e78c67941ab5d238443006837004529"
).map(colors$1);

ramp(scheme$i);

var scheme$j = new Array(3).concat(
  "fff7bcfec44fd95f0e",
  "ffffd4fed98efe9929cc4c02",
  "ffffd4fed98efe9929d95f0e993404",
  "ffffd4fee391fec44ffe9929d95f0e993404",
  "ffffd4fee391fec44ffe9929ec7014cc4c028c2d04",
  "ffffe5fff7bcfee391fec44ffe9929ec7014cc4c028c2d04",
  "ffffe5fff7bcfee391fec44ffe9929ec7014cc4c02993404662506"
).map(colors$1);

ramp(scheme$j);

var scheme$k = new Array(3).concat(
  "ffeda0feb24cf03b20",
  "ffffb2fecc5cfd8d3ce31a1c",
  "ffffb2fecc5cfd8d3cf03b20bd0026",
  "ffffb2fed976feb24cfd8d3cf03b20bd0026",
  "ffffb2fed976feb24cfd8d3cfc4e2ae31a1cb10026",
  "ffffccffeda0fed976feb24cfd8d3cfc4e2ae31a1cb10026",
  "ffffccffeda0fed976feb24cfd8d3cfc4e2ae31a1cbd0026800026"
).map(colors$1);

ramp(scheme$k);

var scheme$l = new Array(3).concat(
  "deebf79ecae13182bd",
  "eff3ffbdd7e76baed62171b5",
  "eff3ffbdd7e76baed63182bd08519c",
  "eff3ffc6dbef9ecae16baed63182bd08519c",
  "eff3ffc6dbef9ecae16baed64292c62171b5084594",
  "f7fbffdeebf7c6dbef9ecae16baed64292c62171b5084594",
  "f7fbffdeebf7c6dbef9ecae16baed64292c62171b508519c08306b"
).map(colors$1);

ramp(scheme$l);

var scheme$m = new Array(3).concat(
  "e5f5e0a1d99b31a354",
  "edf8e9bae4b374c476238b45",
  "edf8e9bae4b374c47631a354006d2c",
  "edf8e9c7e9c0a1d99b74c47631a354006d2c",
  "edf8e9c7e9c0a1d99b74c47641ab5d238b45005a32",
  "f7fcf5e5f5e0c7e9c0a1d99b74c47641ab5d238b45005a32",
  "f7fcf5e5f5e0c7e9c0a1d99b74c47641ab5d238b45006d2c00441b"
).map(colors$1);

ramp(scheme$m);

var scheme$n = new Array(3).concat(
  "f0f0f0bdbdbd636363",
  "f7f7f7cccccc969696525252",
  "f7f7f7cccccc969696636363252525",
  "f7f7f7d9d9d9bdbdbd969696636363252525",
  "f7f7f7d9d9d9bdbdbd969696737373525252252525",
  "fffffff0f0f0d9d9d9bdbdbd969696737373525252252525",
  "fffffff0f0f0d9d9d9bdbdbd969696737373525252252525000000"
).map(colors$1);

ramp(scheme$n);

var scheme$o = new Array(3).concat(
  "efedf5bcbddc756bb1",
  "f2f0f7cbc9e29e9ac86a51a3",
  "f2f0f7cbc9e29e9ac8756bb154278f",
  "f2f0f7dadaebbcbddc9e9ac8756bb154278f",
  "f2f0f7dadaebbcbddc9e9ac8807dba6a51a34a1486",
  "fcfbfdefedf5dadaebbcbddc9e9ac8807dba6a51a34a1486",
  "fcfbfdefedf5dadaebbcbddc9e9ac8807dba6a51a354278f3f007d"
).map(colors$1);

ramp(scheme$o);

var scheme$p = new Array(3).concat(
  "fee0d2fc9272de2d26",
  "fee5d9fcae91fb6a4acb181d",
  "fee5d9fcae91fb6a4ade2d26a50f15",
  "fee5d9fcbba1fc9272fb6a4ade2d26a50f15",
  "fee5d9fcbba1fc9272fb6a4aef3b2ccb181d99000d",
  "fff5f0fee0d2fcbba1fc9272fb6a4aef3b2ccb181d99000d",
  "fff5f0fee0d2fcbba1fc9272fb6a4aef3b2ccb181da50f1567000d"
).map(colors$1);

ramp(scheme$p);

var scheme$q = new Array(3).concat(
  "fee6cefdae6be6550d",
  "feeddefdbe85fd8d3cd94701",
  "feeddefdbe85fd8d3ce6550da63603",
  "feeddefdd0a2fdae6bfd8d3ce6550da63603",
  "feeddefdd0a2fdae6bfd8d3cf16913d948018c2d04",
  "fff5ebfee6cefdd0a2fdae6bfd8d3cf16913d948018c2d04",
  "fff5ebfee6cefdd0a2fdae6bfd8d3cf16913d94801a636037f2704"
).map(colors$1);

ramp(scheme$q);

cubehelixLong(cubehelix(300, 0.5, 0.0), cubehelix(-240, 0.5, 1.0));

var warm = cubehelixLong(cubehelix(-100, 0.75, 0.35), cubehelix(80, 1.50, 0.8));

var cool = cubehelixLong(cubehelix(260, 0.75, 0.35), cubehelix(80, 1.50, 0.8));

var c = cubehelix();

var c$1 = rgb(),
    pi_1_3 = Math.PI / 3,
    pi_2_3 = Math.PI * 2 / 3;

function ramp$1(range) {
  var n = range.length;
  return function(t) {
    return range[Math.max(0, Math.min(n - 1, Math.floor(t * n)))];
  };
}

ramp$1(colors$1("44015444025645045745055946075a46085c460a5d460b5e470d60470e6147106347116447136548146748166848176948186a481a6c481b6d481c6e481d6f481f70482071482173482374482475482576482677482878482979472a7a472c7a472d7b472e7c472f7d46307e46327e46337f463480453581453781453882443983443a83443b84433d84433e85423f854240864241864142874144874045884046883f47883f48893e49893e4a893e4c8a3d4d8a3d4e8a3c4f8a3c508b3b518b3b528b3a538b3a548c39558c39568c38588c38598c375a8c375b8d365c8d365d8d355e8d355f8d34608d34618d33628d33638d32648e32658e31668e31678e31688e30698e306a8e2f6b8e2f6c8e2e6d8e2e6e8e2e6f8e2d708e2d718e2c718e2c728e2c738e2b748e2b758e2a768e2a778e2a788e29798e297a8e297b8e287c8e287d8e277e8e277f8e27808e26818e26828e26828e25838e25848e25858e24868e24878e23888e23898e238a8d228b8d228c8d228d8d218e8d218f8d21908d21918c20928c20928c20938c1f948c1f958b1f968b1f978b1f988b1f998a1f9a8a1e9b8a1e9c891e9d891f9e891f9f881fa0881fa1881fa1871fa28720a38620a48621a58521a68522a78522a88423a98324aa8325ab8225ac8226ad8127ad8128ae8029af7f2ab07f2cb17e2db27d2eb37c2fb47c31b57b32b67a34b67935b77937b87838b9773aba763bbb753dbc743fbc7340bd7242be7144bf7046c06f48c16e4ac16d4cc26c4ec36b50c46a52c56954c56856c66758c7655ac8645cc8635ec96260ca6063cb5f65cb5e67cc5c69cd5b6ccd5a6ece5870cf5773d05675d05477d1537ad1517cd2507fd34e81d34d84d44b86d54989d5488bd6468ed64590d74393d74195d84098d83e9bd93c9dd93ba0da39a2da37a5db36a8db34aadc32addc30b0dd2fb2dd2db5de2bb8de29bade28bddf26c0df25c2df23c5e021c8e020cae11fcde11dd0e11cd2e21bd5e21ad8e219dae319dde318dfe318e2e418e5e419e7e419eae51aece51befe51cf1e51df4e61ef6e620f8e621fbe723fde725"));

var magma = ramp$1(colors$1("00000401000501010601010802010902020b02020d03030f03031204041405041606051806051a07061c08071e0907200a08220b09240c09260d0a290e0b2b100b2d110c2f120d31130d34140e36150e38160f3b180f3d19103f1a10421c10441d11471e114920114b21114e22115024125325125527125829115a2a115c2c115f2d11612f116331116533106734106936106b38106c390f6e3b0f703d0f713f0f72400f74420f75440f764510774710784910784a10794c117a4e117b4f127b51127c52137c54137d56147d57157e59157e5a167e5c167f5d177f5f187f601880621980641a80651a80671b80681c816a1c816b1d816d1d816e1e81701f81721f817320817521817621817822817922827b23827c23827e24828025828125818326818426818627818827818928818b29818c29818e2a81902a81912b81932b80942c80962c80982d80992d809b2e7f9c2e7f9e2f7fa02f7fa1307ea3307ea5317ea6317da8327daa337dab337cad347cae347bb0357bb2357bb3367ab5367ab73779b83779ba3878bc3978bd3977bf3a77c03a76c23b75c43c75c53c74c73d73c83e73ca3e72cc3f71cd4071cf4070d0416fd2426fd3436ed5446dd6456cd8456cd9466bdb476adc4869de4968df4a68e04c67e24d66e34e65e44f64e55064e75263e85362e95462ea5661eb5760ec5860ed5a5fee5b5eef5d5ef05f5ef1605df2625df2645cf3655cf4675cf4695cf56b5cf66c5cf66e5cf7705cf7725cf8745cf8765cf9785df9795df97b5dfa7d5efa7f5efa815ffb835ffb8560fb8761fc8961fc8a62fc8c63fc8e64fc9065fd9266fd9467fd9668fd9869fd9a6afd9b6bfe9d6cfe9f6dfea16efea36ffea571fea772fea973feaa74feac76feae77feb078feb27afeb47bfeb67cfeb77efeb97ffebb81febd82febf84fec185fec287fec488fec68afec88cfeca8dfecc8ffecd90fecf92fed194fed395fed597fed799fed89afdda9cfddc9efddea0fde0a1fde2a3fde3a5fde5a7fde7a9fde9aafdebacfcecaefceeb0fcf0b2fcf2b4fcf4b6fcf6b8fcf7b9fcf9bbfcfbbdfcfdbf"));

var inferno = ramp$1(colors$1("00000401000501010601010802010a02020c02020e03021004031204031405041706041907051b08051d09061f0a07220b07240c08260d08290e092b10092d110a30120a32140b34150b37160b39180c3c190c3e1b0c411c0c431e0c451f0c48210c4a230c4c240c4f260c51280b53290b552b0b572d0b592f0a5b310a5c320a5e340a5f3609613809623909633b09643d09653e0966400a67420a68440a68450a69470b6a490b6a4a0c6b4c0c6b4d0d6c4f0d6c510e6c520e6d540f6d550f6d57106e59106e5a116e5c126e5d126e5f136e61136e62146e64156e65156e67166e69166e6a176e6c186e6d186e6f196e71196e721a6e741a6e751b6e771c6d781c6d7a1d6d7c1d6d7d1e6d7f1e6c801f6c82206c84206b85216b87216b88226a8a226a8c23698d23698f24699025689225689326679526679727669827669a28659b29649d29649f2a63a02a63a22b62a32c61a52c60a62d60a82e5fa92e5eab2f5ead305dae305cb0315bb1325ab3325ab43359b63458b73557b93556ba3655bc3754bd3853bf3952c03a51c13a50c33b4fc43c4ec63d4dc73e4cc83f4bca404acb4149cc4248ce4347cf4446d04545d24644d34743d44842d54a41d74b3fd84c3ed94d3dda4e3cdb503bdd513ade5238df5337e05536e15635e25734e35933e45a31e55c30e65d2fe75e2ee8602de9612bea632aeb6429eb6628ec6726ed6925ee6a24ef6c23ef6e21f06f20f1711ff1731df2741cf3761bf37819f47918f57b17f57d15f67e14f68013f78212f78410f8850ff8870ef8890cf98b0bf98c0af98e09fa9008fa9207fa9407fb9606fb9706fb9906fb9b06fb9d07fc9f07fca108fca309fca50afca60cfca80dfcaa0ffcac11fcae12fcb014fcb216fcb418fbb61afbb81dfbba1ffbbc21fbbe23fac026fac228fac42afac62df9c72ff9c932f9cb35f8cd37f8cf3af7d13df7d340f6d543f6d746f5d949f5db4cf4dd4ff4df53f4e156f3e35af3e55df2e661f2e865f2ea69f1ec6df1ed71f1ef75f1f179f2f27df2f482f3f586f3f68af4f88ef5f992f6fa96f8fb9af9fc9dfafda1fcffa4"));

var plasma = ramp$1(colors$1("0d088710078813078916078a19068c1b068d1d068e20068f2206902406912605912805922a05932c05942e05952f059631059733059735049837049938049a3a049a3c049b3e049c3f049c41049d43039e44039e46039f48039f4903a04b03a14c02a14e02a25002a25102a35302a35502a45601a45801a45901a55b01a55c01a65e01a66001a66100a76300a76400a76600a76700a86900a86a00a86c00a86e00a86f00a87100a87201a87401a87501a87701a87801a87a02a87b02a87d03a87e03a88004a88104a78305a78405a78606a68707a68808a68a09a58b0aa58d0ba58e0ca48f0da4910ea3920fa39410a29511a19613a19814a099159f9a169f9c179e9d189d9e199da01a9ca11b9ba21d9aa31e9aa51f99a62098a72197a82296aa2395ab2494ac2694ad2793ae2892b02991b12a90b22b8fb32c8eb42e8db52f8cb6308bb7318ab83289ba3388bb3488bc3587bd3786be3885bf3984c03a83c13b82c23c81c33d80c43e7fc5407ec6417dc7427cc8437bc9447aca457acb4679cc4778cc4977cd4a76ce4b75cf4c74d04d73d14e72d24f71d35171d45270d5536fd5546ed6556dd7566cd8576bd9586ada5a6ada5b69db5c68dc5d67dd5e66de5f65de6164df6263e06363e16462e26561e26660e3685fe4695ee56a5de56b5de66c5ce76e5be76f5ae87059e97158e97257ea7457eb7556eb7655ec7754ed7953ed7a52ee7b51ef7c51ef7e50f07f4ff0804ef1814df1834cf2844bf3854bf3874af48849f48948f58b47f58c46f68d45f68f44f79044f79143f79342f89441f89540f9973ff9983ef99a3efa9b3dfa9c3cfa9e3bfb9f3afba139fba238fca338fca537fca636fca835fca934fdab33fdac33fdae32fdaf31fdb130fdb22ffdb42ffdb52efeb72dfeb82cfeba2cfebb2bfebd2afebe2afec029fdc229fdc328fdc527fdc627fdc827fdca26fdcb26fccd25fcce25fcd025fcd225fbd324fbd524fbd724fad824fada24f9dc24f9dd25f8df25f8e125f7e225f7e425f6e626f6e826f5e926f5eb27f4ed27f3ee27f3f027f2f227f1f426f1f525f0f724f0f921"));

function constant$3(x) {
  return function constant() {
    return x;
  };
}

var epsilon$2 = 1e-12;
var pi$4 = Math.PI;

function Linear(context) {
  this._context = context;
}

Linear.prototype = {
  areaStart: function() {
    this._line = 0;
  },
  areaEnd: function() {
    this._line = NaN;
  },
  lineStart: function() {
    this._point = 0;
  },
  lineEnd: function() {
    if (this._line || (this._line !== 0 && this._point === 1)) this._context.closePath();
    this._line = 1 - this._line;
  },
  point: function(x, y) {
    x = +x, y = +y;
    switch (this._point) {
      case 0: this._point = 1; this._line ? this._context.lineTo(x, y) : this._context.moveTo(x, y); break;
      case 1: this._point = 2; // proceed
      default: this._context.lineTo(x, y); break;
    }
  }
};

function curveLinear(context) {
  return new Linear(context);
}

function x(p) {
  return p[0];
}

function y(p) {
  return p[1];
}

function line() {
  var x$1 = x,
      y$1 = y,
      defined = constant$3(true),
      context = null,
      curve = curveLinear,
      output = null;

  function line(data) {
    var i,
        n = data.length,
        d,
        defined0 = false,
        buffer;

    if (context == null) output = curve(buffer = path$1());

    for (i = 0; i <= n; ++i) {
      if (!(i < n && defined(d = data[i], i, data)) === defined0) {
        if (defined0 = !defined0) output.lineStart();
        else output.lineEnd();
      }
      if (defined0) output.point(+x$1(d, i, data), +y$1(d, i, data));
    }

    if (buffer) return output = null, buffer + "" || null;
  }

  line.x = function(_) {
    return arguments.length ? (x$1 = typeof _ === "function" ? _ : constant$3(+_), line) : x$1;
  };

  line.y = function(_) {
    return arguments.length ? (y$1 = typeof _ === "function" ? _ : constant$3(+_), line) : y$1;
  };

  line.defined = function(_) {
    return arguments.length ? (defined = typeof _ === "function" ? _ : constant$3(!!_), line) : defined;
  };

  line.curve = function(_) {
    return arguments.length ? (curve = _, context != null && (output = curve(context)), line) : curve;
  };

  line.context = function(_) {
    return arguments.length ? (_ == null ? context = output = null : output = curve(context = _), line) : context;
  };

  return line;
}

function point(that, x, y) {
  that._context.bezierCurveTo(
    that._x1 + that._k * (that._x2 - that._x0),
    that._y1 + that._k * (that._y2 - that._y0),
    that._x2 + that._k * (that._x1 - x),
    that._y2 + that._k * (that._y1 - y),
    that._x2,
    that._y2
  );
}

function Cardinal(context, tension) {
  this._context = context;
  this._k = (1 - tension) / 6;
}

Cardinal.prototype = {
  areaStart: function() {
    this._line = 0;
  },
  areaEnd: function() {
    this._line = NaN;
  },
  lineStart: function() {
    this._x0 = this._x1 = this._x2 =
    this._y0 = this._y1 = this._y2 = NaN;
    this._point = 0;
  },
  lineEnd: function() {
    switch (this._point) {
      case 2: this._context.lineTo(this._x2, this._y2); break;
      case 3: point(this, this._x1, this._y1); break;
    }
    if (this._line || (this._line !== 0 && this._point === 1)) this._context.closePath();
    this._line = 1 - this._line;
  },
  point: function(x, y) {
    x = +x, y = +y;
    switch (this._point) {
      case 0: this._point = 1; this._line ? this._context.lineTo(x, y) : this._context.moveTo(x, y); break;
      case 1: this._point = 2; this._x1 = x, this._y1 = y; break;
      case 2: this._point = 3; // proceed
      default: point(this, x, y); break;
    }
    this._x0 = this._x1, this._x1 = this._x2, this._x2 = x;
    this._y0 = this._y1, this._y1 = this._y2, this._y2 = y;
  }
};

function point$1(that, x, y) {
  var x1 = that._x1,
      y1 = that._y1,
      x2 = that._x2,
      y2 = that._y2;

  if (that._l01_a > epsilon$2) {
    var a = 2 * that._l01_2a + 3 * that._l01_a * that._l12_a + that._l12_2a,
        n = 3 * that._l01_a * (that._l01_a + that._l12_a);
    x1 = (x1 * a - that._x0 * that._l12_2a + that._x2 * that._l01_2a) / n;
    y1 = (y1 * a - that._y0 * that._l12_2a + that._y2 * that._l01_2a) / n;
  }

  if (that._l23_a > epsilon$2) {
    var b = 2 * that._l23_2a + 3 * that._l23_a * that._l12_a + that._l12_2a,
        m = 3 * that._l23_a * (that._l23_a + that._l12_a);
    x2 = (x2 * b + that._x1 * that._l23_2a - x * that._l12_2a) / m;
    y2 = (y2 * b + that._y1 * that._l23_2a - y * that._l12_2a) / m;
  }

  that._context.bezierCurveTo(x1, y1, x2, y2, that._x2, that._y2);
}

function CatmullRom(context, alpha) {
  this._context = context;
  this._alpha = alpha;
}

CatmullRom.prototype = {
  areaStart: function() {
    this._line = 0;
  },
  areaEnd: function() {
    this._line = NaN;
  },
  lineStart: function() {
    this._x0 = this._x1 = this._x2 =
    this._y0 = this._y1 = this._y2 = NaN;
    this._l01_a = this._l12_a = this._l23_a =
    this._l01_2a = this._l12_2a = this._l23_2a =
    this._point = 0;
  },
  lineEnd: function() {
    switch (this._point) {
      case 2: this._context.lineTo(this._x2, this._y2); break;
      case 3: this.point(this._x2, this._y2); break;
    }
    if (this._line || (this._line !== 0 && this._point === 1)) this._context.closePath();
    this._line = 1 - this._line;
  },
  point: function(x, y) {
    x = +x, y = +y;

    if (this._point) {
      var x23 = this._x2 - x,
          y23 = this._y2 - y;
      this._l23_a = Math.sqrt(this._l23_2a = Math.pow(x23 * x23 + y23 * y23, this._alpha));
    }

    switch (this._point) {
      case 0: this._point = 1; this._line ? this._context.lineTo(x, y) : this._context.moveTo(x, y); break;
      case 1: this._point = 2; break;
      case 2: this._point = 3; // proceed
      default: point$1(this, x, y); break;
    }

    this._l01_a = this._l12_a, this._l12_a = this._l23_a;
    this._l01_2a = this._l12_2a, this._l12_2a = this._l23_2a;
    this._x0 = this._x1, this._x1 = this._x2, this._x2 = x;
    this._y0 = this._y1, this._y1 = this._y2, this._y2 = y;
  }
};

var catmullRom = (function custom(alpha) {

  function catmullRom(context) {
    return alpha ? new CatmullRom(context, alpha) : new Cardinal(context, 0);
  }

  catmullRom.alpha = function(alpha) {
    return custom(+alpha);
  };

  return catmullRom;
})(0.5);

function sign(x) {
  return x < 0 ? -1 : 1;
}

// Calculate the slopes of the tangents (Hermite-type interpolation) based on
// the following paper: Steffen, M. 1990. A Simple Method for Monotonic
// Interpolation in One Dimension. Astronomy and Astrophysics, Vol. 239, NO.
// NOV(II), P. 443, 1990.
function slope3(that, x2, y2) {
  var h0 = that._x1 - that._x0,
      h1 = x2 - that._x1,
      s0 = (that._y1 - that._y0) / (h0 || h1 < 0 && -0),
      s1 = (y2 - that._y1) / (h1 || h0 < 0 && -0),
      p = (s0 * h1 + s1 * h0) / (h0 + h1);
  return (sign(s0) + sign(s1)) * Math.min(Math.abs(s0), Math.abs(s1), 0.5 * Math.abs(p)) || 0;
}

// Calculate a one-sided slope.
function slope2(that, t) {
  var h = that._x1 - that._x0;
  return h ? (3 * (that._y1 - that._y0) / h - t) / 2 : t;
}

// According to https://en.wikipedia.org/wiki/Cubic_Hermite_spline#Representations
// "you can express cubic Hermite interpolation in terms of cubic Bézier curves
// with respect to the four values p0, p0 + m0 / 3, p1 - m1 / 3, p1".
function point$2(that, t0, t1) {
  var x0 = that._x0,
      y0 = that._y0,
      x1 = that._x1,
      y1 = that._y1,
      dx = (x1 - x0) / 3;
  that._context.bezierCurveTo(x0 + dx, y0 + dx * t0, x1 - dx, y1 - dx * t1, x1, y1);
}

function MonotoneX(context) {
  this._context = context;
}

MonotoneX.prototype = {
  areaStart: function() {
    this._line = 0;
  },
  areaEnd: function() {
    this._line = NaN;
  },
  lineStart: function() {
    this._x0 = this._x1 =
    this._y0 = this._y1 =
    this._t0 = NaN;
    this._point = 0;
  },
  lineEnd: function() {
    switch (this._point) {
      case 2: this._context.lineTo(this._x1, this._y1); break;
      case 3: point$2(this, this._t0, slope2(this, this._t0)); break;
    }
    if (this._line || (this._line !== 0 && this._point === 1)) this._context.closePath();
    this._line = 1 - this._line;
  },
  point: function(x, y) {
    var t1 = NaN;

    x = +x, y = +y;
    if (x === this._x1 && y === this._y1) return; // Ignore coincident points.
    switch (this._point) {
      case 0: this._point = 1; this._line ? this._context.lineTo(x, y) : this._context.moveTo(x, y); break;
      case 1: this._point = 2; break;
      case 2: this._point = 3; point$2(this, slope2(this, t1 = slope3(this, x, y)), t1); break;
      default: point$2(this, this._t0, t1 = slope3(this, x, y)); break;
    }

    this._x0 = this._x1, this._x1 = x;
    this._y0 = this._y1, this._y1 = y;
    this._t0 = t1;
  }
};

function MonotoneY(context) {
  this._context = new ReflectContext(context);
}

(MonotoneY.prototype = Object.create(MonotoneX.prototype)).point = function(x, y) {
  MonotoneX.prototype.point.call(this, y, x);
};

function ReflectContext(context) {
  this._context = context;
}

ReflectContext.prototype = {
  moveTo: function(x, y) { this._context.moveTo(y, x); },
  closePath: function() { this._context.closePath(); },
  lineTo: function(x, y) { this._context.lineTo(y, x); },
  bezierCurveTo: function(x1, y1, x2, y2, x, y) { this._context.bezierCurveTo(y1, x1, y2, x2, y, x); }
};

function scatter(blueprint) {
  var width = blueprint.canvas.width;
  var height = blueprint.canvas.height;
  var svg = select("#".concat(blueprint.canvas.name)).append("svg").attr('id', 'svg-canvas').attr("preserveAspectRatio", "xMinYMin").attr("width", width).attr("height", height).append("g").attr("transform", "translate(" + blueprint.canvas.margin.left + "," + blueprint.canvas.margin.top + ")"); // var fileName=path.join('/Users/chand/workbench/work/keynotes/photovoltaics/viz/band.csv')

  var dataFile = blueprint.data.file.split('[')[0];
  csv$1(dataFile).then(function (data) {
    trace(blueprint, data, svg);
  });
  return svg;
}

function trace(blueprint, data, svg) {
  // domain sould be set here
  var x, y, xy, xselect, yselect, xcol, ycol;
  var xDom, yDom; // style variables
  xselect = 0;
  yselect = 1;
  var columnRegex = /\[(.*?)\]|\[(.*?)\]/g;
  var cols = blueprint.data.file.match(columnRegex); // TODO-file not provided

  var scatterColors = colors(blueprint.data.color);

  if (cols != null) {
    xselect = Number(cols[0].slice(1, 2)) - 1;
    yselect = Number(cols[0].slice(3, 4)) - 1;
  }

  xcol = "".concat(data.columns[xselect]);
  ycol = "".concat(data.columns[yselect]); // TODO - domain defaults based on data multiple files
  // 

  xDom = [min(data, function (d) {
    return +d[xcol];
  }), max(data, function (d) {
    return +d[xcol];
  })];
  yDom = [min(data, function (d) {
    return +d[ycol];
  }), max(data, function (d) {
    return +d[ycol];
  })];

  if (blueprint.data.domain) {
    blueprint.data.domain.x ? xDom = blueprint.data.domain.x : xDom;
    blueprint.data.domain.y ? yDom = blueprint.data.domain.y : yDom;
  }

  xy = setAxis(blueprint, xDom, yDom, svg);
  x = xy.x;
  y = xy.y; // TODO - scatterColors length != cols.length ??

  for (var i = 0; i < cols.length; i++) {
    if (cols != null) {
      xselect = Number(cols[i].slice(1, 2)) - 1;
      yselect = Number(cols[i].slice(3, 4)) - 1;
    }

    xcol = "".concat(data.columns[xselect]);
    ycol = "".concat(data.columns[yselect]);
    var groupBy = "".concat(data.columns[blueprint.data.groupBy[0] - 1]); //TODO -groupBy[i]

    var band = nest() // nest based on bandindex
    .key(function (d) {
      return d[groupBy];
    }).entries(data);
    var line$1 = line().defined(function (d) {
      return +d[ycol] >= y.domain()[0] && +d[ycol] <= y.domain()[1];
    }).x(function (d) {
      return x(+d[xcol]);
    }).y(function (d) {
      return y(+d[ycol]);
    });

    if (blueprint.data.smooth) {
      if (blueprint.data.smooth == 'spline-cat') {
        line$1.curve(catmullRom);
      }
    }

    svg.selectAll('band').data(band).enter().append("path").attr('class', 'someclass').attr('stroke', scatterColors[i]).attr("stroke-width", 2.5).attr("opacity", 1).attr("fill", 'none').attr("d", function (d) {
      return line$1(d.values);
    });
  }
}

function setAxis(blueprint, xDom, yDom, svg) {
  var width = blueprint.canvas.width - blueprint.canvas.margin.left - blueprint.canvas.margin.right;
  var height = blueprint.canvas.height - blueprint.canvas.margin.top - blueprint.canvas.margin.bottom;
  var x = linear$1().range([0, width]).domain(xDom);
  var y = linear$1().range([height, 0]).domain(yDom);
  var tickLabel = blueprint.data.tick.label; //TODO-default
  // Add the x-axis at bottom of the page

  svg.append("g").attr("class", "x-axis").attr("transform", "translate(0," + height + ")").call(axisBottom(x).tickValues(tickLabel.slice(0, tickLabel.length - 1).map(function (d) {
    return d.x;
  })).tickFormat(function () {
    return '';
  }).tickSize(-height)); // Add the y-axis.

  svg.append("g").attr("class", "y-axis").attr("transform", "translate(" + 0 + ",0)").call(axisLeft(y).ticks(7).tickSize(-10));
  var tx = -5;
  var ty = 10;
  var tw = 40;
  var th = 50;
  svg.append("g").call(x).selectAll("g").data(tickLabel).enter().append("foreignObject").attr('class', 'xTicks').attr("transform", "translate(0," + height + ")").attr("width", tw).attr("height", th).attr("x", function (d) {
    return x(d.x) + tx;
  }).attr("y", ty).html(function (d) {
    return d.label;
  }); // add the x-axis at top of the page

  svg.append("g").attr("class", "x-axis").attr("transform", "translate(0,-1)").call(axisTop(x).tickValues(tickLabel.map(function (d) {
    return d.x;
  })).tickFormat(function () {
    return '';
  }).tickSize(-5)); // add the y-axis at right of the page

  svg.append("g").attr("class", "y-axis").attr("transform", "translate(" + width + ",0)").call(axisRight(y).ticks(7).tickSize(-5).tickFormat(function () {
    return '';
  }));
  return {
    x: x,
    y: y
  };
}

exports.PI = PI;
exports.colors = colors;
exports.scatter = scatter;

Object.defineProperty(exports, '__esModule', { value: true });

}));
