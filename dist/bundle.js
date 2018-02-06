'use strict';

var commonjsGlobal = typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : typeof self !== 'undefined' ? self : {};



function unwrapExports (x) {
	return x && x.__esModule && Object.prototype.hasOwnProperty.call(x, 'default') ? x['default'] : x;
}

function createCommonjsModule(fn, module) {
	return module = { exports: {} }, fn(module, module.exports), module.exports;
}

var __extends = (commonjsGlobal && commonjsGlobal.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
var TokenError = (function (_super) {
    __extends(TokenError, _super);
    function TokenError(message, token) {
        _super.call(this, message);
        this.message = message;
        this.token = token;
        if (token && token.errors)
            token.errors.push(this);
        else
            throw this;
    }
    TokenError.prototype.inspect = function () {
        return 'SyntaxError: ' + this.message;
    };
    return TokenError;
}(Error));
var TokenError_2 = TokenError;


var TokenError_1 = {
	TokenError: TokenError_2
};

var Parser_1 = createCommonjsModule(function (module, exports) {
// https://www.ics.uci.edu/~pattis/ICS-33/lectures/ebnf.pdf
var UPPER_SNAKE_RE = /^[A-Z0-9_]+$/;
var decorationRE = /(\?|\+|\*)$/;
var preDecorationRE = /^(@|&|!)/;
var WS_RULE = 'WS';

function readToken(txt, expr) {
    var result = expr.exec(txt);
    if (result && result.index == 0) {
        if (result[0].length == 0 && expr.source.length > 0)
            return null;
        return {
            type: null,
            text: result[0],
            rest: txt.substr(result[0].length),
            start: 0,
            end: result[0].length - 1,
            fullText: result[0],
            errors: [],
            children: [],
            parent: null
        };
    }
    return null;
}
exports.readToken = readToken;
function escapeRegExp(str) {
    return str.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, "\\$&");
}
function fixRest(token) {
    token.rest = '';
    token.children && token.children.forEach(function (c) { return fixRest(c); });
}
function fixPositions(token, start) {
    token.start += start;
    token.end += start;
    token.children && token.children.forEach(function (c) { return fixPositions(c, token.start); });
}
function agregateErrors(errors, token) {
    if (token.errors && token.errors.length)
        token.errors.forEach(function (err) { return errors.push(err); });
    token.children && token.children.forEach(function (tok) { return agregateErrors(errors, tok); });
}
function parseRuleName(name) {
    var postDecoration = decorationRE.exec(name);
    var preDecoration = preDecorationRE.exec(name);
    var postDecorationText = postDecoration && postDecoration[0] || '';
    var preDecorationText = preDecoration && preDecoration[0] || '';
    var out = {
        raw: name,
        name: name.replace(decorationRE, '').replace(preDecorationRE, ''),
        isOptional: postDecorationText == '?' || postDecorationText == '*',
        allowRepetition: postDecorationText == '+' || postDecorationText == '*',
        atLeastOne: postDecorationText == '+',
        lookupPositive: preDecorationText == '&',
        lookupNegative: preDecorationText == '!',
        pinned: preDecorationText == '@',
        lookup: false,
        isLiteral: false
    };
    out.isLiteral = out.name[0] == "'" || out.name[0] == '"';
    out.lookup = out.lookupNegative || out.lookupPositive;
    return out;
}
exports.parseRuleName = parseRuleName;
function findRuleByName(name, parser) {
    var parsed = parseRuleName(name);
    return parser.cachedRules[parsed.name] || null;
}
exports.findRuleByName = findRuleByName;
/// Removes all the nodes starting with 'RULE_'
function stripRules(token, re) {
    if (token.children) {
        var localRules = token.children.filter(function (x) { return x.type && re.test(x.type); });
        for (var i = 0; i < localRules.length; i++) {
            var indexOnChildren = token.children.indexOf(localRules[i]);
            if (indexOnChildren != -1) {
                token.children.splice(indexOnChildren, 1);
            }
        }
        token.children.forEach(function (c) { return stripRules(c, re); });
    }
}
var ignoreMissingRules = ['EOF'];
var Parser = (function () {
    function Parser(grammarRules, options) {
        var _this = this;
        this.grammarRules = grammarRules;
        this.options = options;
        this.debug = false;
        this.cachedRules = {};
        var errors = [];
        var neededRules = [];
        grammarRules.forEach(function (rule) {
            var parsedName = parseRuleName(rule.name);
            if (parsedName.name in _this.cachedRules) {
                errors.push('Duplicated rule ' + name);
                return;
            }
            else {
                _this.cachedRules[parsedName.name] = rule;
            }
            if (!rule.bnf || !rule.bnf.length) {
                var error = 'Missing rule content, rule: ' + rule.name;
                if (errors.indexOf(error) == -1)
                    errors.push(error);
            }
            else {
                rule.bnf.forEach(function (options) {
                    if (typeof options[0] === 'string') {
                        var parsed = parseRuleName(options[0]);
                        if (parsed.name == rule.name) {
                            var error = 'Left recursion is not allowed, rule: ' + rule.name;
                            if (errors.indexOf(error) == -1)
                                errors.push(error);
                        }
                    }
                    options.forEach(function (option) {
                        if (typeof option == "string") {
                            var name_1 = parseRuleName(option);
                            if (!name_1.isLiteral && neededRules.indexOf(name_1.name) == -1 && ignoreMissingRules.indexOf(name_1.name) == -1)
                                neededRules.push(name_1.name);
                        }
                    });
                });
            }
            if (WS_RULE == rule.name)
                rule.implicitWs = false;
            if (rule.implicitWs) {
                if (neededRules.indexOf(WS_RULE) == -1)
                    neededRules.push(WS_RULE);
            }
            if (rule.recover) {
                if (neededRules.indexOf(rule.recover) == -1)
                    neededRules.push(rule.recover);
            }
        });
        neededRules.forEach(function (ruleName) {
            if (!(ruleName in _this.cachedRules)) {
                errors.push('Missing rule ' + ruleName);
            }
        });
        if (errors.length)
            throw new Error(errors.join('\n'));
    }
    Parser.prototype.getAST = function (txt, target) {
        if (!target) {
            target = this.grammarRules.filter(function (x) { return !x.fragment && x.name.indexOf('%') != 0; })[0].name;
        }
        var result = this.parse(txt, target);
        if (result) {
            agregateErrors(result.errors, result);
            fixPositions(result, 0);
            // REMOVE ALL THE TAGS MATCHING /^%/
            stripRules(result, /^%/);
            if (!this.options || !this.options.keepUpperRules)
                stripRules(result, UPPER_SNAKE_RE);
            var rest = result.rest;
            if (rest) {
                new TokenError_1.TokenError('Unexpected end of input: ' + JSON.stringify(rest) + txt, result);
            }
            fixRest(result);
            result.rest = rest;
        }
        return result;
    };
    Parser.prototype.emitSource = function () {
        return 'CANNOT EMIT SOURCE FROM BASE Parser';
    };
    Parser.prototype.parse = function (txt, target, recursion) {
        var _this = this;
        if (recursion === void 0) { recursion = 0; }
        var out = null;
        var type = parseRuleName(target);
        var expr;
        var printable = this.debug && !UPPER_SNAKE_RE.test(type.name);
        printable && console.log(new Array(recursion).join('│  ') + 'Trying to get ' + target + ' from ' + JSON.stringify(txt.split('\n')[0]));
        var realType = type.name;
        var targetLex = findRuleByName(type.name, this);
        if (type.name == 'EOF') {
            if (txt.length) {
                return null;
            }
            else if (txt.length == 0) {
                return {
                    type: 'EOF',
                    text: '',
                    rest: '',
                    start: 0,
                    end: 0,
                    fullText: '',
                    errors: [],
                    children: [],
                    parent: null
                };
            }
        }
        try {
            if (!targetLex && type.isLiteral) {
                var src = commonjsGlobal.eval(type.name);
                if (src === "") {
                    return {
                        type: '%%EMPTY%%',
                        text: '',
                        rest: txt,
                        start: 0,
                        end: 0,
                        fullText: '',
                        errors: [],
                        children: [],
                        parent: null
                    };
                }
                expr = new RegExp(escapeRegExp(src));
                realType = null;
            }
        }
        catch (e) {
            return null;
        }
        if (expr) {
            var result = readToken(txt, expr);
            if (result) {
                result.type = realType;
                return result;
            }
        }
        else {
            var options = targetLex.bnf;
            if (options instanceof Array) {
                options.forEach(function (phases) {
                    if (out)
                        return;
                    var pinned = false;
                    var tmp = {
                        type: type.name,
                        text: '',
                        children: [],
                        end: 0,
                        errors: [],
                        fullText: '',
                        parent: null,
                        start: 0,
                        rest: txt
                    };
                    if (targetLex.fragment)
                        tmp.fragment = true;
                    var tmpTxt = txt;
                    var position = 0;
                    var allOptional = phases.length > 0;
                    var foundSomething = false;
                    for (var i = 0; i < phases.length; i++) {
                        if (typeof phases[i] == "string") {
                            var localTarget = parseRuleName(phases[i]);
                            allOptional = allOptional && localTarget.isOptional;
                            var got = void 0;
                            var foundAtLeastOne = false;
                            do {
                                got = null;
                                if (targetLex.implicitWs) {
                                    got = _this.parse(tmpTxt, localTarget.name, recursion + 1);
                                    if (!got) {
                                        var WS = void 0;
                                        do {
                                            WS = _this.parse(tmpTxt, WS_RULE, recursion + 1);
                                            if (WS) {
                                                tmp.text = tmp.text + WS.text;
                                                tmp.end = tmp.text.length;
                                                WS.parent = tmp;
                                                tmp.children.push(WS);
                                                tmpTxt = tmpTxt.substr(WS.text.length);
                                                position += WS.text.length;
                                            }
                                            else {
                                                break;
                                            }
                                        } while (WS && WS.text.length);
                                    }
                                }
                                got = got || _this.parse(tmpTxt, localTarget.name, recursion + 1);
                                // rule ::= "true" ![a-zA-Z]
                                // negative lookup, if it does not matches, we should continue
                                if (localTarget.lookupNegative) {
                                    if (got)
                                        return;
                                    break;
                                }
                                if (localTarget.lookupPositive) {
                                    if (!got)
                                        return;
                                }
                                if (!got) {
                                    if (localTarget.isOptional)
                                        break;
                                    if (localTarget.atLeastOne && foundAtLeastOne)
                                        break;
                                }
                                if (got && targetLex.pinned == (i + 1)) {
                                    pinned = true;
                                    printable && console.log(new Array(recursion + 1).join('│  ') + '└─ ' + got.type + ' PINNED');
                                }
                                if (!got)
                                    got = _this.parseRecovery(targetLex, tmpTxt, recursion + 1);
                                if (!got) {
                                    if (pinned) {
                                        out = tmp;
                                        got = {
                                            type: 'SyntaxError',
                                            text: tmpTxt,
                                            children: [],
                                            end: tmpTxt.length,
                                            errors: [],
                                            fullText: '',
                                            parent: null,
                                            start: 0,
                                            rest: ''
                                        };
                                        new TokenError_1.TokenError('Unexpected end of input: ' + tmpTxt, got);
                                        printable && console.log(new Array(recursion + 1).join('│  ') + '└─ ' + got.type + ' ' + JSON.stringify(got.text));
                                    }
                                    else {
                                        return;
                                    }
                                }
                                foundAtLeastOne = true;
                                foundSomething = true;
                                if (got.type == '%%EMPTY%%') {
                                    break;
                                }
                                got.start += position;
                                got.end += position;
                                if (!localTarget.lookupPositive && got.type) {
                                    if (got.fragment) {
                                        got.children && got.children.forEach(function (x) {
                                            x.start += position;
                                            x.end += position;
                                            x.parent = tmp;
                                            tmp.children.push(x);
                                        });
                                    }
                                    else {
                                        got.parent = tmp;
                                        tmp.children.push(got);
                                    }
                                }
                                if (localTarget.lookup)
                                    got.lookup = true;
                                printable && console.log(new Array(recursion + 1).join('│  ') + '└─ ' + got.type + ' ' + JSON.stringify(got.text));
                                // Eat it from the input stream, only if it is not a lookup
                                if (!localTarget.lookup && !got.lookup) {
                                    tmp.text = tmp.text + got.text;
                                    tmp.end = tmp.text.length;
                                    tmpTxt = tmpTxt.substr(got.text.length);
                                    position += got.text.length;
                                }
                                tmp.rest = tmpTxt;
                            } while (got && localTarget.allowRepetition && tmpTxt.length && !got.lookup);
                        }
                        else {
                            var got = readToken(tmpTxt, phases[i]);
                            if (!got) {
                                return;
                            }
                            printable && console.log(new Array(recursion + 1).join('│  ') + '└> ' + JSON.stringify(got.text) + phases[i].source);
                            foundSomething = true;
                            got.start += position;
                            got.end += position;
                            tmp.text = tmp.text + got.text;
                            tmp.end = tmp.text.length;
                            tmpTxt = tmpTxt.substr(got.text.length);
                            position += got.text.length;
                            tmp.rest = tmpTxt;
                        }
                    }
                    if (foundSomething) {
                        out = tmp;
                        printable && console.log(new Array(recursion).join('│  ') + '├<─┴< PUSHING ' + out.type + " " + JSON.stringify(out.text));
                    }
                });
            }
        }
        if (!out) {
            printable && console.log(target + ' NOT RESOLVED FROM ' + txt);
        }
        return out;
    };
    Parser.prototype.parseRecovery = function (recoverableToken, tmpTxt, recursion) {
        if (recoverableToken.recover && tmpTxt.length) {
            var printable = this.debug;
            printable && console.log(new Array(recursion + 1).join('│  ') + 'Trying to recover until token ' + recoverableToken.recover + ' from ' + JSON.stringify(tmpTxt.split('\n')[0] + tmpTxt.split('\n')[1]));
            var tmp = {
                type: 'SyntaxError',
                text: '',
                children: [],
                end: 0,
                errors: [],
                fullText: '',
                parent: null,
                start: 0,
                rest: ''
            };
            var got = void 0;
            do {
                got = this.parse(tmpTxt, recoverableToken.recover, recursion + 1);
                if (got) {
                    new TokenError_1.TokenError('Unexpected input: ' + tmp.text, tmp);
                    break;
                }
                else {
                    tmp.text = tmp.text + tmpTxt[0];
                    tmp.end = tmp.text.length;
                    tmpTxt = tmpTxt.substr(1);
                }
            } while (!got && tmpTxt.length > 0);
            if (tmp.text.length > 0 && got) {
                printable && console.log(new Array(recursion + 1).join('│  ') + 'Recovered text: ' + JSON.stringify(tmp.text));
                return tmp;
            }
        }
        return null;
    };
    return Parser;
}());
exports.Parser = Parser;
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = Parser;

});

unwrapExports(Parser_1);
var Parser_2 = Parser_1.readToken;
var Parser_3 = Parser_1.parseRuleName;
var Parser_4 = Parser_1.findRuleByName;
var Parser_5 = Parser_1.Parser;

/**
 * Finds all the direct childs of a specifyed type
 */
function findChildrenByType(token, type) {
    return token.children ? token.children.filter(function (x) { return x.type == type; }) : [];
}
var findChildrenByType_1 = findChildrenByType;


var SemanticHelpers = {
	findChildrenByType: findChildrenByType_1
};

var BNF_1 = createCommonjsModule(function (module, exports) {
// https://en.wikipedia.org/wiki/Backus%E2%80%93Naur_Form
var __extends = (commonjsGlobal && commonjsGlobal.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
/*
syntax ::= RULE_EOL* rule+
rule ::= " "* "<" rule-name ">" " "* "::=" firstExpression otherExpression* " "* RULE_EOL+ " "*
firstExpression ::= " "* list
otherExpression ::= " "* "|" " "* list
RULE_EOL ::= "\r" | "\n"
list ::= term " "* list | term
term ::= literal | "<" rule-name ">"
literal ::= '"' RULE_CHARACTER1* '"' | "'" RULE_CHARACTER2* "'"
RULE_CHARACTER ::= " " | RULE_LETTER | RULE_DIGIT | RULE_SYMBOL
RULE_LETTER ::= "A" | "B" | "C" | "D" | "E" | "F" | "G" | "H" | "I" | "J" | "K" | "L" | "M" | "N" | "O" | "P" | "Q" | "R" | "S" | "T" | "U" | "V" | "W" | "X" | "Y" | "Z" | "a" | "b" | "c" | "d" | "e" | "f" | "g" | "h" | "i" | "j" | "k" | "l" | "m" | "n" | "o" | "p" | "q" | "r" | "s" | "t" | "u" | "v" | "w" | "x" | "y" | "z"
RULE_DIGIT ::= "0" | "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9"
RULE_SYMBOL ::= "-" | "_" | "!" | "#" | "$" | "%" | "&" | "(" | ")" | "*" | "+" | "," | "-" | "." | "/" | ":" | ";" | "<" | "=" | ">" | "?" | "@" | "[" | "\" | "]" | "^" | "_" | "`" | "{" | "|" | "}" | "~"
RULE_CHARACTER1 ::= RULE_CHARACTER | "'"
RULE_CHARACTER2 ::= RULE_CHARACTER | '"'
rule-name ::= RULE_LETTER RULE_CHAR*
RULE_CHAR ::= RULE_LETTER | RULE_DIGIT | "_" | "-"
*/


var BNF;
(function (BNF) {
    BNF.RULES = [
        {
            name: 'syntax',
            bnf: [
                ['RULE_EOL*', 'rule+']
            ]
        }, {
            name: 'rule',
            bnf: [
                ['" "*', '"<"', 'rule-name', '">"', '" "*', '"::="', 'firstExpression', 'otherExpression*', '" "*', 'RULE_EOL+', '" "*']
            ]
        }, {
            name: 'firstExpression',
            bnf: [
                ['" "*', 'list']
            ]
        }, {
            name: 'otherExpression',
            bnf: [
                ['" "*', '"|"', '" "*', 'list'],
            ]
        }, {
            name: 'RULE_EOL',
            bnf: [
                ['"\\r"'],
                ['"\\n"']
            ]
        }, {
            name: 'list',
            bnf: [
                ['term', '" "*', 'list'],
                ['term']
            ]
        }, {
            name: 'term',
            bnf: [
                ['literal'],
                ['"<"', 'rule-name', '">"'],
            ]
        }, {
            name: 'literal',
            bnf: [
                ["'\"'", 'RULE_CHARACTER1*', "'\"'"],
                ["\"'\"", 'RULE_CHARACTER2*', "\"'\""],
            ]
        }, {
            name: 'RULE_CHARACTER',
            bnf: [['" "'], ['RULE_LETTER'], ['RULE_DIGIT'], ['RULE_SYMBOL']]
        }, {
            name: 'RULE_LETTER',
            bnf: [
                ['"A"'], ['"B"'], ['"C"'], ['"D"'], ['"E"'], ['"F"'], ['"G"'], ['"H"'], ['"I"'], ['"J"'], ['"K"'], ['"L"'], ['"M"'], ['"N"'], ['"O"'], ['"P"'], ['"Q"'], ['"R"'], ['"S"'], ['"T"'], ['"U"'], ['"V"'], ['"W"'], ['"X"'], ['"Y"'], ['"Z"'], ['"a"'], ['"b"'], ['"c"'], ['"d"'], ['"e"'], ['"f"'], ['"g"'], ['"h"'], ['"i"'], ['"j"'], ['"k"'], ['"l"'], ['"m"'], ['"n"'], ['"o"'], ['"p"'], ['"q"'], ['"r"'], ['"s"'], ['"t"'], ['"u"'], ['"v"'], ['"w"'], ['"x"'], ['"y"'], ['"z"']
            ]
        }, {
            name: 'RULE_DIGIT',
            bnf: [
                ['"0"'], ['"1"'], ['"2"'], ['"3"'], ['"4"'], ['"5"'], ['"6"'], ['"7"'], ['"8"'], ['"9"']
            ]
        }, {
            name: 'RULE_SYMBOL',
            bnf: [
                ['"-"'], ['"_"'], ['"!"'], ['"#"'], ['"$"'], ['"%"'], ['"&"'], ['"("'], ['")"'], ['"*"'], ['"+"'], ['","'], ['"-"'], ['"."'], ['"/"'], ['":"'], ['";"'], ['"<"'], ['"="'], ['">"'], ['"?"'], ['"@"'], ['"["'], ['"\\"'], ['"]"'], ['"^"'], ['"_"'], ['"`"'], ['"{"'], ['"|"'], ['"}"'], ['"~"']
            ]
        }, {
            name: 'RULE_CHARACTER1',
            bnf: [['RULE_CHARACTER'], ["\"'\""]]
        }, {
            name: 'RULE_CHARACTER2',
            bnf: [['RULE_CHARACTER'], ["'\"'"]]
        }, {
            name: 'rule-name',
            bnf: [['RULE_LETTER', 'RULE_CHAR*']]
        }, {
            name: 'RULE_CHAR',
            bnf: [['RULE_LETTER'], ['RULE_DIGIT'], ['"_"'], ['"-"']]
        }
    ];
    BNF.parser = new dist.Parser(BNF.RULES, {});
    function getAllTerms(expr) {
        var terms = SemanticHelpers.findChildrenByType(expr, 'term').map(function (term) {
            return SemanticHelpers.findChildrenByType(term, 'literal').concat(SemanticHelpers.findChildrenByType(term, 'rule-name'))[0].text;
        });
        SemanticHelpers.findChildrenByType(expr, 'list').forEach(function (expr) {
            terms = terms.concat(getAllTerms(expr));
        });
        return terms;
    }
    function getRules(source) {
        var ast = BNF.parser.getAST(source);
        if (!ast)
            throw new Error('Could not parse ' + source);
        if (ast.errors && ast.errors.length) {
            throw ast.errors[0];
        }
        var rules = SemanticHelpers.findChildrenByType(ast, 'rule');
        var ret = rules.map(function (rule) {
            var name = SemanticHelpers.findChildrenByType(rule, 'rule-name')[0].text;
            var expressions = SemanticHelpers.findChildrenByType(rule, 'firstExpression')
                .concat(SemanticHelpers.findChildrenByType(rule, 'otherExpression'));
            var bnf = [];
            expressions.forEach(function (expr) {
                bnf.push(getAllTerms(expr));
            });
            return {
                name: name,
                bnf: bnf
            };
        });
        if (!ret.some(function (x) { return x.name == 'EOL'; })) {
            ret.push({
                name: 'EOL',
                bnf: [['"\\r\\n"', '"\\r"', '"\\n"']]
            });
        }
        return ret;
    }
    BNF.getRules = getRules;
    function Transform(source) {
        return getRules(source.join(''));
    }
    BNF.Transform = Transform;
    var Parser = (function (_super) {
        __extends(Parser, _super);
        function Parser(source, options) {
            _super.call(this, getRules(source), options);
            this.source = source;
        }
        Parser.prototype.emitSource = function () {
            return this.source;
        };
        return Parser;
    }(dist.Parser));
    BNF.Parser = Parser;
})(BNF || (BNF = {}));
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = BNF;

});

unwrapExports(BNF_1);

var W3CEBNF = createCommonjsModule(function (module, exports) {
// https://www.w3.org/TR/REC-xml/#NT-Name
// http://www.bottlecaps.de/rr/ui
var __extends = (commonjsGlobal && commonjsGlobal.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
// Grammar	::=	Production*
// Production	::=	NCName '::=' Choice
// NCName	::=	[http://www.w3.org/TR/xml-names/#NT-NCName]
// Choice	::=	SequenceOrDifference ( '|' SequenceOrDifference )*
// SequenceOrDifference	::=	(Item ( '-' Item | Item* ))?
// Item	::=	Primary ( '?' | '*' | '+' )?
// Primary	::=	NCName | StringLiteral | CharCode | CharClass | '(' Choice ')'
// StringLiteral	::=	'"' [^"]* '"' | "'" [^']* "'"
// CharCode	::=	'#x' [0-9a-fA-F]+
// CharClass	::=	'[' '^'? ( RULE_Char | CharCode | CharRange | CharCodeRange )+ ']'
// RULE_Char	::=	[http://www.w3.org/TR/xml#NT-RULE_Char]
// CharRange	::=	RULE_Char '-' ( RULE_Char - ']' )
// CharCodeRange	::=	CharCode '-' CharCode
// RULE_WHITESPACE	::=	RULE_S | Comment
// RULE_S	::=	#x9 | #xA | #xD | #x20
// Comment	::=	'/*' ( [^*] | '*'+ [^*/] )* '*'* '*/'


var BNF;
(function (BNF) {
    BNF.RULES = [
        {
            name: 'Grammar',
            bnf: [
                ['RULE_S*', '%Atomic*', 'EOF']
            ]
        }, {
            name: '%Atomic',
            bnf: [['Production', 'RULE_S*']],
            fragment: true
        }, {
            name: 'Production',
            bnf: [['NCName', 'RULE_S*', '"::="', 'RULE_WHITESPACE*', 'Choice', 'RULE_WHITESPACE*', 'RULE_EOL+', 'RULE_S*']]
        }, {
            name: 'NCName',
            bnf: [[/[a-zA-Z][a-zA-Z_0-9]*/]]
        }, {
            name: 'Choice',
            bnf: [['SequenceOrDifference', '%_Choice_1*']],
            fragment: true
        }, {
            name: '%_Choice_1',
            bnf: [['RULE_WHITESPACE*', '"|"', 'RULE_WHITESPACE*', 'SequenceOrDifference']],
            fragment: true
        }, {
            name: 'SequenceOrDifference',
            bnf: [['Item', 'RULE_WHITESPACE*', '%_Item_1?']]
        }, {
            name: '%_Item_1',
            bnf: [['Minus', 'Item'], ['Item*']],
            fragment: true
        }, {
            name: 'Minus',
            bnf: [['"-"']]
        }, {
            name: 'Item',
            bnf: [['RULE_WHITESPACE*', '%Primary', 'PrimaryDecoration?']],
            fragment: true
        }, {
            name: 'PrimaryDecoration',
            bnf: [['"?"'], ['"*"'], ['"+"']]
        }, {
            name: 'DecorationName',
            bnf: [['"ebnf://"', /[^\x5D#]+/]]
        }, {
            name: '%Primary',
            bnf: [
                ['NCName'],
                ['StringLiteral'],
                ['CharCode'],
                ['CharClass'],
                ['SubItem']
            ],
            fragment: true
        }, {
            name: 'SubItem',
            bnf: [['"("', 'RULE_WHITESPACE*', 'Choice', 'RULE_WHITESPACE*', '")"']]
        }, {
            name: 'StringLiteral',
            bnf: [["'\"'", /[^"]*/, "'\"'"], ["\"'\"", /[^']*/, "\"'\""]],
            pinned: 1
        }, {
            name: 'CharCode',
            bnf: [['"#x"', /[0-9a-zA-Z]+/]]
        }, {
            name: 'CharClass',
            bnf: [
                ["'['", "'^'?", '%RULE_CharClass_1+', '"]"']
            ]
        }, {
            name: '%RULE_CharClass_1',
            bnf: [['CharCodeRange'], ['CharRange'], ['CharCode'], ['RULE_Char']],
            fragment: true
        }, {
            name: 'RULE_Char',
            bnf: [[/\x09/], [/\x0A/], [/\x0D/], [/[\x20-\x5c]/], [/[\x5e-\uD7FF]/], [/[\uE000-\uFFFD]/]]
        }, {
            name: 'CharRange',
            bnf: [['RULE_Char', '"-"', 'RULE_Char']]
        }, {
            name: 'CharCodeRange',
            bnf: [['CharCode', '"-"', 'CharCode']]
        }, {
            name: 'RULE_WHITESPACE',
            bnf: [['%RULE_WHITESPACE_CHAR*'], ['Comment', 'RULE_WHITESPACE*']]
        }, {
            name: 'RULE_S',
            bnf: [['RULE_WHITESPACE', 'RULE_S*'], ['RULE_EOL', 'RULE_S*']]
        }, {
            name: '%RULE_WHITESPACE_CHAR',
            bnf: [[/\x09/], [/\x20/]],
            fragment: true
        }, {
            name: 'Comment',
            bnf: [['"/*"', '%RULE_Comment_Body*', '"*/"']]
        }, {
            name: '%RULE_Comment_Body',
            bnf: [['!"*/"', /[^*]/]],
            fragment: true
        }, {
            name: 'RULE_EOL',
            bnf: [[/\x0D/, /\x0A/], [/\x0A/], [/\x0D/]]
        }, {
            name: 'Link',
            bnf: [["'['", 'Url', "']'"]]
        }, {
            name: 'Url',
            bnf: [[/[^\x5D:/?#]/, '"://"', /[^\x5D#]+/, '%Url1?']]
        }, {
            name: '%Url1',
            bnf: [['"#"', 'NCName']],
            fragment: true
        }
    ];
    BNF.parser = new dist.Parser(BNF.RULES, {});
    var preDecorationRE = /^(!|&)/;
    var decorationRE = /(\?|\+|\*)$/;
    var subExpressionRE = /^%/;
    function getBNFRule(name, parser) {
        if (typeof name == 'string') {
            if (preDecorationRE.test(name))
                return '';
            var subexpression = subExpressionRE.test(name);
            if (subexpression) {
                var decoration = decorationRE.exec(name);
                var decorationText = decoration ? decoration[0] + ' ' : '';
                var lonely = isLonelyRule(name, parser);
                if (lonely)
                    return getBNFBody(name, parser) + decorationText;
                return '(' + getBNFBody(name, parser) + ')' + decorationText;
            }
            return name;
        }
        else {
            return name.source
                .replace(/\\(?:x|u)([a-zA-Z0-9]+)/g, '#x$1')
                .replace(/\[\\(?:x|u)([a-zA-Z0-9]+)-\\(?:x|u)([a-zA-Z0-9]+)\]/g, '[#x$1-#x$2]');
        }
    }
    /// Returns true if the rule is a string literal or regular expression without a descendant tree
    function isLonelyRule(name, parser) {
        var rule = Parser_1.findRuleByName(name, parser);
        return rule && rule.bnf.length == 1 && rule.bnf[0].length == 1 && (rule.bnf[0][0] instanceof RegExp || rule.bnf[0][0][0] == '"' || rule.bnf[0][0][0] == "'");
    }
    function getBNFChoice(rules, parser) {
        return rules.map(function (x) { return getBNFRule(x, parser); }).join(' ');
    }
    function getBNFBody(name, parser) {
        var rule = Parser_1.findRuleByName(name, parser);
        if (rule)
            return rule.bnf.map(function (x) { return getBNFChoice(x, parser); }).join(' | ');
        return 'RULE_NOT_FOUND {' + name + '}';
    }
    function emit(parser) {
        var acumulator = [];
        parser.grammarRules.forEach(function (l) {
            if (!(/^%/.test(l.name))) {
                var recover = l.recover ? ' /* { recoverUntil=' + l.recover + ' } */' : '';
                acumulator.push(l.name + ' ::= ' + getBNFBody(l.name, parser) + recover);
            }
        });
        return acumulator.join('\n');
    }
    BNF.emit = emit;
    var subitems = 0;
    function restar(total, resta) {
        console.log('reberia restar ' + resta + ' a ' + total);
        throw new Error('Difference not supported yet');
    }
    function convertRegex(txt) {
        return new RegExp(txt
            .replace(/#x([a-zA-Z0-9]{4})/g, '\\u$1')
            .replace(/#x([a-zA-Z0-9]{3})/g, '\\u0$1')
            .replace(/#x([a-zA-Z0-9]{2})/g, '\\x$1')
            .replace(/#x([a-zA-Z0-9]{1})/g, '\\x0$1'));
    }
    function getSubItems(tmpRules, seq, parentName) {
        var anterior = null;
        var bnfSeq = [];
        seq.children.forEach(function (x, i) {
            if (x.type == 'Minus') {
                restar(anterior, x);
            }
            else {
            }
            var decoration = seq.children[i + 1];
            decoration = decoration && decoration.type == 'PrimaryDecoration' && decoration.text || '';
            var preDecoration = '';
            switch (x.type) {
                case 'SubItem':
                    var name_1 = '%' + (parentName + (subitems++));
                    createRule(tmpRules, x, name_1);
                    bnfSeq.push(preDecoration + name_1 + decoration);
                    break;
                case 'NCName':
                case 'StringLiteral':
                    bnfSeq.push(preDecoration + x.text + decoration);
                    break;
                case 'CharCode':
                case 'CharClass':
                    if (decoration || preDecoration) {
                        var newRule = {
                            name: '%' + (parentName + (subitems++)),
                            bnf: [[convertRegex(x.text)]]
                        };
                        tmpRules.push(newRule);
                        bnfSeq.push(preDecoration + newRule.name + decoration);
                    }
                    else {
                        bnfSeq.push(convertRegex(x.text));
                    }
                    break;
                case 'PrimaryDecoration':
                    break;
                default:
                    throw new Error(' HOW SHOULD I PARSE THIS? ' + x.type + ' -> ' + JSON.stringify(x.text));
            }
            anterior = x;
        });
        return bnfSeq;
    }
    function createRule(tmpRules, token, name) {
        var bnf = token.children.filter(function (x) { return x.type == 'SequenceOrDifference'; }).map(function (s) { return getSubItems(tmpRules, s, name); });
        var rule = {
            name: name,
            bnf: bnf
        };
        var recover = null;
        bnf.forEach(function (x) {
            recover = recover || x["recover"];
            delete x["recover"];
        });
        if (name.indexOf('%') == 0)
            rule.fragment = true;
        if (recover)
            rule.recover = recover;
        tmpRules.push(rule);
    }
    function getRules(source) {
        var ast = BNF.parser.getAST(source);
        if (!ast)
            throw new Error('Could not parse ' + source);
        if (ast.errors && ast.errors.length) {
            throw ast.errors[0];
        }
        var tmpRules = [];
        ast.children
            .filter(function (x) { return x.type == 'Production'; })
            .map(function (x) {
            var name = x.children.filter(function (x) { return x.type == 'NCName'; })[0].text;
            createRule(tmpRules, x, name);
        });
        return tmpRules;
    }
    BNF.getRules = getRules;
    function Transform(source) {
        return getRules(source.join(''));
    }
    BNF.Transform = Transform;
    var Parser = (function (_super) {
        __extends(Parser, _super);
        function Parser(source, options) {
            _super.call(this, getRules(source), options);
        }
        Parser.prototype.emitSource = function () {
            return emit(this);
        };
        return Parser;
    }(dist.Parser));
    BNF.Parser = Parser;
})(BNF || (BNF = {}));
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = BNF;

});

unwrapExports(W3CEBNF);

var Custom = createCommonjsModule(function (module, exports) {
// https://www.w3.org/TR/REC-xml/#NT-Name
// http://www.bottlecaps.de/rr/ui
var __extends = (commonjsGlobal && commonjsGlobal.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
// Grammar	::=	Production*
// Production	::=	NCName '::=' Choice
// NCName	::=	[http://www.w3.org/TR/xml-names/#NT-NCName]
// Choice	::=	SequenceOrDifference ( '|' SequenceOrDifference )*
// SequenceOrDifference	::=	(Item ( '-' Item | Item* ))?
// Item	::=	Primary ( '?' | '*' | '+' )?
// Primary	::=	NCName | StringLiteral | CharCode | CharClass | '(' Choice ')'
// StringLiteral	::=	'"' [^"]* '"' | "'" [^']* "'"
// CharCode	::=	'#x' [0-9a-fA-F]+
// CharClass	::=	'[' '^'? ( RULE_Char | CharCode | CharRange | CharCodeRange )+ ']'
// RULE_Char	::=	[http://www.w3.org/TR/xml#NT-RULE_Char]
// CharRange	::=	RULE_Char '-' ( RULE_Char - ']' )
// CharCodeRange	::=	CharCode '-' CharCode
// RULE_WHITESPACE	::=	RULE_S | Comment
// RULE_S	::=	#x9 | #xA | #xD | #x20
// Comment	::=	'/*' ( [^*] | '*'+ [^*/] )* '*'* '*/'


var BNF;
(function (BNF) {
    BNF.RULES = [
        {
            name: 'Grammar',
            bnf: [
                ['RULE_S*', 'Attributes?', 'RULE_S*', '%Atomic*', 'EOF']
            ]
        }, {
            name: '%Atomic',
            bnf: [['Production', 'RULE_S*']],
            fragment: true
        }, {
            name: 'Production',
            bnf: [['NCName', 'RULE_S*', '"::="', 'RULE_WHITESPACE*', '%Choice', 'RULE_WHITESPACE*', 'Attributes?', 'RULE_EOL+', 'RULE_S*']]
        }, {
            name: 'NCName',
            bnf: [[/[a-zA-Z][a-zA-Z_0-9]*/]]
        }, {
            name: 'Attributes',
            bnf: [['"{"', 'Attribute', '%Attributes*', 'RULE_S*', '"}"']]
        }, {
            name: '%Attributes',
            bnf: [['RULE_S*', '","', 'Attribute']],
            fragment: true
        }, {
            name: 'Attribute',
            bnf: [['RULE_S*', 'NCName', 'RULE_WHITESPACE*', '"="', 'RULE_WHITESPACE*', 'AttributeValue']]
        }, {
            name: 'AttributeValue',
            bnf: [['NCName'], [/[1-9][0-9]*/]]
        }, {
            name: '%Choice',
            bnf: [['SequenceOrDifference', '%_Choice_1*']],
            fragment: true
        }, {
            name: '%_Choice_1',
            bnf: [['RULE_WHITESPACE*', '"|"', 'RULE_WHITESPACE*', 'SequenceOrDifference']],
            fragment: true
        }, {
            name: 'SequenceOrDifference',
            bnf: [['%Item', 'RULE_WHITESPACE*', '%_Item_1?']]
        }, {
            name: '%_Item_1',
            bnf: [['Minus', '%Item'], ['%Item*']],
            fragment: true
        }, {
            name: 'Minus',
            bnf: [['"-"']]
        }, {
            name: '%Item',
            bnf: [['RULE_WHITESPACE*', 'PrimaryPreDecoration?', '%Primary', 'PrimaryDecoration?']],
            fragment: true
        }, {
            name: 'PrimaryDecoration',
            bnf: [['"?"'], ['"*"'], ['"+"']]
        }, {
            name: 'PrimaryPreDecoration',
            bnf: [['"&"'], ['"!"'], ['"~"']]
        }, {
            name: '%Primary',
            bnf: [
                ['NCName'],
                ['StringLiteral'],
                ['CharCode'],
                ['CharClass'],
                ['SubItem']
            ],
            fragment: true
        }, {
            name: 'SubItem',
            bnf: [['"("', 'RULE_WHITESPACE*', '%Choice', 'RULE_WHITESPACE*', '")"']]
        }, {
            name: 'StringLiteral',
            bnf: [["'\"'", /[^"]*/, "'\"'"], ["\"'\"", /[^']*/, "\"'\""]]
        }, {
            name: 'CharCode',
            bnf: [['"#x"', /[0-9a-zA-Z]+/]]
        }, {
            name: 'CharClass',
            bnf: [
                ["'['", "'^'?", '%RULE_CharClass_1+', '"]"']
            ]
        }, {
            name: '%RULE_CharClass_1',
            bnf: [['CharCodeRange'], ['CharRange'], ['CharCode'], ['RULE_Char']],
            fragment: true
        }, {
            name: 'RULE_Char',
            bnf: [[/\x09/], [/\x0A/], [/\x0D/], [/[\x20-\x5c]/], [/[\x5e-\uD7FF]/], [/[\uE000-\uFFFD]/]]
        }, {
            name: 'CharRange',
            bnf: [['RULE_Char', '"-"', 'RULE_Char']]
        }, {
            name: 'CharCodeRange',
            bnf: [['CharCode', '"-"', 'CharCode']]
        }, {
            name: 'RULE_WHITESPACE',
            bnf: [['%RULE_WHITESPACE_CHAR*'], ['Comment', 'RULE_WHITESPACE*']]
        }, {
            name: 'RULE_S',
            bnf: [['RULE_WHITESPACE', 'RULE_S*'], ['RULE_EOL', 'RULE_S*']]
        }, {
            name: '%RULE_WHITESPACE_CHAR',
            bnf: [[/\x09/], [/\x20/]],
            fragment: true
        }, {
            name: 'Comment',
            bnf: [['"/*"', '%RULE_Comment_Body*', '"*/"']]
        }, {
            name: '%RULE_Comment_Body',
            bnf: [[/[^*]/], ['"*"+', /[^/]*/]],
            fragment: true
        }, {
            name: 'RULE_EOL',
            bnf: [[/\x0D/, /\x0A/], [/\x0A/], [/\x0D/]]
        }, {
            name: 'Link',
            bnf: [["'['", 'Url', "']'"]]
        }, {
            name: 'Url',
            bnf: [[/[^\x5D:/?#]/, '"://"', /[^\x5D#]+/, '%Url1?']]
        }, {
            name: '%Url1',
            bnf: [['"#"', 'NCName']],
            fragment: true
        }
    ];
    BNF.parser = new dist.Parser(BNF.RULES, {});
    var preDecorationRE = /^(!|&)/;
    var decorationRE = /(\?|\+|\*)$/;
    var subExpressionRE = /^%/;
    function getBNFRule(name, parser) {
        if (typeof name == 'string') {
            var decoration = decorationRE.exec(name);
            var preDecoration = preDecorationRE.exec(name);
            var preDecorationText = preDecoration ? preDecoration[0] : '';
            var decorationText = decoration ? decoration[0] + ' ' : '';
            var subexpression = subExpressionRE.test(name);
            if (subexpression) {
                var lonely = isLonelyRule(name, parser);
                if (lonely)
                    return preDecorationText + getBNFBody(name, parser) + decorationText;
                return preDecorationText + '(' + getBNFBody(name, parser) + ')' + decorationText;
            }
            return name.replace(preDecorationRE, preDecorationText);
        }
        else {
            return name.source
                .replace(/\\(?:x|u)([a-zA-Z0-9]+)/g, '#x$1')
                .replace(/\[\\(?:x|u)([a-zA-Z0-9]+)-\\(?:x|u)([a-zA-Z0-9]+)\]/g, '[#x$1-#x$2]');
        }
    }
    /// Returns true if the rule is a string literal or regular expression without a descendant tree
    function isLonelyRule(name, parser) {
        var rule = Parser_1.findRuleByName(name, parser);
        return rule && rule.bnf.length == 1 && rule.bnf[0].length == 1 && (rule.bnf[0][0] instanceof RegExp || rule.bnf[0][0][0] == '"' || rule.bnf[0][0][0] == "'");
    }
    function getBNFChoice(rules, parser) {
        return rules.map(function (x) { return getBNFRule(x, parser); }).join(' ');
    }
    function getBNFBody(name, parser) {
        var rule = Parser_1.findRuleByName(name, parser);
        if (rule)
            return rule.bnf.map(function (x) { return getBNFChoice(x, parser); }).join(' | ');
        return 'RULE_NOT_FOUND {' + name + '}';
    }
    function emit(parser) {
        var acumulator = [];
        parser.grammarRules.forEach(function (l) {
            if (!(/^%/.test(l.name))) {
                var recover = l.recover ? ' { recoverUntil=' + l.recover + ' }' : '';
                acumulator.push(l.name + ' ::= ' + getBNFBody(l.name, parser) + recover);
            }
        });
        return acumulator.join('\n');
    }
    BNF.emit = emit;
    var subitems = 0;
    function restar(total, resta) {
        console.log('reberia restar ' + resta + ' a ' + total);
        throw new Error('Difference not supported yet');
    }
    function convertRegex(txt) {
        return new RegExp(txt
            .replace(/#x([a-zA-Z0-9]{4})/g, '\\u$1')
            .replace(/#x([a-zA-Z0-9]{3})/g, '\\u0$1')
            .replace(/#x([a-zA-Z0-9]{2})/g, '\\x$1')
            .replace(/#x([a-zA-Z0-9]{1})/g, '\\x0$1'));
    }
    function getSubItems(tmpRules, seq, parentName) {
        var anterior = null;
        var bnfSeq = [];
        seq.children.forEach(function (x, i) {
            if (x.type == 'Minus') {
                restar(anterior, x);
            }
            else {
            }
            var decoration = seq.children[i + 1];
            decoration = decoration && decoration.type == 'PrimaryDecoration' && decoration.text || '';
            var preDecoration = '';
            if (anterior && anterior.type == 'PrimaryPreDecoration') {
                preDecoration = anterior.text;
            }
            var pinned = preDecoration == '~';
            if (pinned) {
                preDecoration = '';
            }
            switch (x.type) {
                case 'SubItem':
                    var name_1 = '%' + (parentName + (subitems++));
                    createRule(tmpRules, x, name_1);
                    bnfSeq.push(preDecoration + name_1 + decoration);
                    break;
                case 'NCName':
                case 'StringLiteral':
                    bnfSeq.push(preDecoration + x.text + decoration);
                    break;
                case 'CharCode':
                case 'CharClass':
                    if (decoration || preDecoration) {
                        var newRule = {
                            name: '%' + (parentName + (subitems++)),
                            bnf: [[convertRegex(x.text)]],
                            pinned: pinned
                        };
                        tmpRules.push(newRule);
                        bnfSeq.push(preDecoration + newRule.name + decoration);
                    }
                    else {
                        bnfSeq.push(convertRegex(x.text));
                    }
                    break;
                case 'PrimaryPreDecoration':
                case 'PrimaryDecoration':
                    break;
                default:
                    throw new Error(' HOW SHOULD I PARSE THIS? ' + x.type + ' -> ' + JSON.stringify(x.text));
            }
            anterior = x;
        });
        return bnfSeq;
    }
    function createRule(tmpRules, token, name) {
        var bnf = token.children.filter(function (x) { return x.type == 'SequenceOrDifference'; }).map(function (s) { return getSubItems(tmpRules, s, name); });
        var attrNode = token.children.filter(function (x) { return x.type == 'Attributes'; })[0];
        var attributes = {};
        if (attrNode) {
            attrNode.children.forEach(function (x) {
                var name = x.children.filter(function (x) { return x.type == 'NCName'; })[0].text;
                if (name in attributes) {
                    throw new dist.TokenError("Duplicated attribute " + name, x);
                }
                else {
                    attributes[name] = x.children.filter(function (x) { return x.type == 'AttributeValue'; })[0].text;
                }
            });
        }
        var rule = {
            name: name,
            bnf: bnf
        };
        if (name.indexOf('%') == 0)
            rule.fragment = true;
        if (attributes["recoverUntil"]) {
            rule.recover = attributes["recoverUntil"];
            if (rule.bnf.length > 1)
                throw new dist.TokenError('only one-option productions are suitable for error recovering', token);
        }
        if ("pin" in attributes) {
            var num = parseInt(attributes["pin"]);
            if (!isNaN(num)) {
                rule.pinned = num;
            }
            if (rule.bnf.length > 1)
                throw new dist.TokenError('only one-option productions are suitable for pinning', token);
        }
        if ("ws" in attributes) {
            rule.implicitWs = attributes["ws"] != 'explicit';
        }
        else {
            rule.implicitWs = null;
        }
        rule.fragment = rule.fragment || attributes["fragment"] == "true";
        tmpRules.push(rule);
    }
    function getRules(source) {
        var ast = BNF.parser.getAST(source);
        if (!ast)
            throw new Error('Could not parse ' + source);
        if (ast.errors && ast.errors.length) {
            throw ast.errors[0];
        }
        var implicitWs = null;
        var attrNode = ast.children.filter(function (x) { return x.type == 'Attributes'; })[0];
        var attributes = {};
        if (attrNode) {
            attrNode.children.forEach(function (x) {
                var name = x.children.filter(function (x) { return x.type == 'NCName'; })[0].text;
                if (name in attributes) {
                    throw new dist.TokenError("Duplicated attribute " + name, x);
                }
                else {
                    attributes[name] = x.children.filter(function (x) { return x.type == 'AttributeValue'; })[0].text;
                }
            });
        }
        implicitWs = attributes['ws'] == 'implicit';
        var tmpRules = [];
        ast.children
            .filter(function (x) { return x.type == 'Production'; })
            .map(function (x) {
            var name = x.children.filter(function (x) { return x.type == 'NCName'; })[0].text;
            createRule(tmpRules, x, name);
        });
        tmpRules.forEach(function (rule) {
            if (rule.implicitWs === null)
                rule.implicitWs = implicitWs;
        });
        return tmpRules;
    }
    BNF.getRules = getRules;
    function Transform(source) {
        return getRules(source.join(''));
    }
    BNF.Transform = Transform;
    var Parser = (function (_super) {
        __extends(Parser, _super);
        function Parser(source, options) {
            _super.call(this, getRules(source), options);
        }
        Parser.prototype.emitSource = function () {
            return emit(this);
        };
        return Parser;
    }(dist.Parser));
    BNF.Parser = Parser;
})(BNF || (BNF = {}));
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = BNF;

});

unwrapExports(Custom);

var BNF$1 = BNF_1.default;

var W3C = W3CEBNF.default;

var Custom$2 = Custom.default;


var Grammars = {
	BNF: BNF$1,
	W3C: W3C,
	Custom: Custom$2
};

var Parser$1 = Parser_1.Parser;

var TokenError$1 = TokenError_1.TokenError;
var Grammars$2 = Grammars;


var dist = {
	Parser: Parser$1,
	TokenError: TokenError$1,
	Grammars: Grammars$2
};

const fs = require('fs');
// const util = require('util')
// const Grammars = require('ebnf').Grammars

// const {code, cursorPos} = require('./scenario1')



const grammar = fs.readFileSync('./grammars/preschool.ebnf', {encoding: 'utf8'});
// console.log(grammar)
const parser = new Grammars$2.BNF.Parser(grammar, {keepUpperRules: true});
console.log(parser);

/*
interface IToken {
    type: string;         // Rule name
    text: string;         // Inner text
    children: IToken[];   // Children nodes
    start: number;        // Start position of the input string
    end: number;          // End position
    errors: TokenError[]; // List of Errors
}
*/
// const ast = parser.getAST(code)
//
// const findAtomicNode = node => {
//     if (node.end === cursorPos && node.children.length === 0) {
//         return node
//     }
//     return node.children.map(child => findAtomicNode(child)).filter(node => node)[0]
// }
// const atomicNode = findAtomicNode(ast)
// // console.log(util.inspect(atomicNode, {showHidden: false, depth: null}))
//
// const nodesEndingAtCursorPos = [atomicNode]
//
// let parent = atomicNode.parent
// while (parent && parent.end === cursorPos) {
//     nodesEndingAtCursorPos.push(parent)
//     parent = parent.parent
// }
//
// console.log(parser.grammarRules[0])
// console.log(nodesEndingAtCursorPos)




//
// // console.log(parser.getAST(' '))
// const ast = parser.getAST('-12')
// // console.log(ast)
//
// const printNode = node => {
//     if (!node) {
//         return
//     }
//     console.log(node)
//     for (const child of node.children) {
//         printNode(child)
//     }
// }
// printNode(ast)
// // let node = ast
// // while (node) {
// //     node =
// // }
//
//
// // console.log(parser.getAST('-122 + 2'))
// // console.log(parser.getAST('-122 asdf + 2'))
