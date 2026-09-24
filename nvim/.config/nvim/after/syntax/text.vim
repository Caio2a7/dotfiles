" Vim syntax file for enhanced text / CLI output highlighting
" Supports Go, Shell, Java, C/C++, Python constructs in text and doc files

" Types (Builtins vs Struct/Custom Types)
syntax keyword txtTypeBuiltin int int8 int16 int32 int64 uint uint8 uint16 uint32 uint64 uintptr float32 float64 string bool byte rune error any void boolean char short long float double size_t ssize_t uint8_t uint16_t uint32_t uint64_t int8_t int16_t int32_t int64_t
syntax keyword txtType String Object Integer Long List Map Set

" Targeted Capitalized Types (accompanied by struct, const, var, pointer *, or inside parentheses)
syntax match txtType "\<[A-Z][a-zA-Z0-9_]*\>\ze\s\+\%(struct\|interface\)\>"
syntax match txtType "\%(\<\%(struct\|interface\)\>\s\+\)\@<=\<[A-Z][a-zA-Z0-9_]*\>"
syntax match txtType "\%(\<type\>\s\+\)\@<=\<[A-Z][a-zA-Z0-9_]*\>"
syntax match txtType "\%(\<const\>\s\+\)\@<=\<[A-Z][a-zA-Z0-9_]*\>"
syntax match txtType "\%(\<const\>\s\+\S\+\s\+\)\@<=\<[A-Z][a-zA-Z0-9_]*\>"
syntax match txtType "\%(\<var\>\s\+\)\@<=\<[A-Z][a-zA-Z0-9_]*\>"
syntax match txtType "\%(\<var\>\s\+\S\+\s\+\)\@<=\<[A-Z][a-zA-Z0-9_]*\>"
syntax match txtType "\%(\*\)\@<=\<[A-Za-z_][a-zA-Z0-9_]*\>"

" Parentheses Region (highlights types inside parentheses like (Conn, error) or (c *Client))
syntax region txtParen start="(" end=")" transparent contains=txtTypeParen,txtType,txtOperator,txtComment,txtString,txtNumber,txtBoolean,txtTypeBuiltin,txtFunction,txtBug,txtTodo
syntax match txtTypeParen "\<[A-Z][a-zA-Z0-9_]*\>" contained

" Go Constructs & Keywords
syntax keyword txtGoKeyword func type struct interface package import defer go select chan make new var const
syntax keyword txtRepeat for while do range
syntax keyword txtReturn return break continue
syntax keyword txtCond if else elif switch case default try catch finally

" Numbers & Constants
syntax keyword txtBoolean true false True False nil null None NULL nullptr iota
syntax match txtNumber "\<\d\+\(\.\d\+\)\?\>"
syntax match txtNumber "\<0x[0-9a-fA-F]\+\>"

" Java & OOP
syntax keyword txtJavaKeyword public private protected class extends implements static final abstract synchronized throws throw new this super enum record
syntax match txtAnnotation "@\<[A-Za-z0-9_]\+\>"

" C / C++ & Preprocessor
syntax match txtPreProc "^\s*#\s*\(include\|define\|ifdef\|ifndef\|endif\|pragma\)\>"
syntax keyword txtCKeyword typedef union sizeof unsigned signed extern volatile

" Shell, Commands & Environment Variables
syntax keyword txtShell export source alias sudo chmod chown curl wget docker kubectl git env
syntax match txtEnvVar "\<[A-Za-z_][A-Za-z0-9_]*\ze="
syntax match txtShellVar "\$[A-Za-z0-9_]\+"
syntax match txtShellVar "\${[A-Za-z0-9_]\+}"
syntax match txtFlag "\s\zs\-\-[a-zA-Z0-9_\-]\+\>"
syntax match txtFlag "\s\zs\-[a-zA-Z0-9]\+\>"

" Functions
syntax match txtFunction "\<[A-Za-z_][A-Za-z0-9_]*\ze("

" Operators
syntax match txtOperator ":="
syntax match txtOperator "==\|!=\|<=\|>=\|&&\|||\|<-\|->\|[+*\-%&|^~<>!=]"
syntax match txtOperator "/\%(/\|\*\)\@!"

" Strings and Characters (oneline prevents bleeding; apostrophes in words/contractions are ignored)
syntax region txtString start=+"+ skip=+\\"+ end=+"+ oneline contains=@Spell
syntax region txtString start=+`+ end=+`+ oneline contains=@Spell
syntax region txtString start=+\%(\w\)\@<!'\%(\%([sStTdDmM]\|re\|ve\|ll\)\%(\s\|$\|[.,;!?]\)\)\@!+ skip=+\\'+ end=+'+ oneline contains=@Spell

" Bug & Todo Tags (in comments and standalone)
syntax match txtBug "\<BUG\((\S\+)\)\?:" contained
syntax match txtBug "\[BUG\]" contained
syntax match txtBug "\<BUG\((\S\+)\)\?:"
syntax match txtBug "\[BUG\]"
syntax match txtTodo "\<\(TODO\|FIXME\|NOTE\|HACK\|WARN\|WARNING\)\>:" contained
syntax match txtTodo "\<\(TODO\|FIXME\|NOTE\|HACK\|WARN\|WARNING\)\>:"

" Comments (defined last to ensure whole-comment precedence, contains tags)
syntax match txtComment "//.*$" contains=txtBug,txtTodo,@Spell
syntax match txtComment "/\*\_.\{-}\*/" contains=txtBug,txtTodo,@Spell
syntax match txtComment "^\s*#\s.*$" contains=txtBug,txtTodo,@Spell
syntax match txtComment "\s\+#\s.*$" contains=txtBug,txtTodo,@Spell

" URLs & Network
syntax match txtUrl "https\?://[^\s)\]>"']\+"

" Fallback highlight links (used if custom colors are reset)
highlight default link txtComment Comment
highlight default link txtString String
highlight default link txtNumber Number
highlight default link txtBoolean Boolean
highlight default link txtGoKeyword Keyword
highlight default link txtRepeat Repeat
highlight default link txtReturn PreProc
highlight default link txtCond Conditional
highlight default link txtOperator Operator
highlight default link txtFunction Function
highlight default link txtShell PreProc
highlight default link txtEnvVar Identifier
highlight default link txtShellVar Identifier
highlight default link txtFlag Special
highlight default link txtJavaKeyword Keyword
highlight default link txtAnnotation PreProc
highlight default link txtPreProc PreProc
highlight default link txtCKeyword Keyword
highlight default link txtTypeBuiltin Keyword
highlight default link txtType Type
highlight default link txtTypeParen txtType
highlight default link txtUrl Underlined
highlight default link txtBug ErrorMsg
highlight default link txtTodo Todo
