// You have to restart QPad for changes to take effect
// The default is English UI with simplified Chinese fallback fonts
(function(){
	var g_translations={
		"en_us":{},
		"zh_cn":{
			"Files":"文件列表",
			"Binary Tools":"二进制工具",
			///////////////
			"&File":"文件(&F)",
			///////////////
			"&Edit":"编辑(&E)",
			"&Search":"查找(&S)",
			"Con&vert":"转换(&V)",
			"&Language":"语言(&L)",
			"&Run":"运行(&R)",
			"&Tools":"工具(&T)",
			"Ter&minal":"远程终端(&M)",
			///////////////
			"Failed to load this binary file":"二进制文件打开失败",
			"&Undo":"撤销(&U)",
			"&Redo":"重做(&R)",
			"Go to":"跳转到",
			"Display width":"宽度",
			"Display type":"类型",
			"Display color":"颜色",
			"The file was using @1 encoding. Should you save it, it will be converted to UTF-8 instead.":"这个文件原先是@1编码的。不过要是存了就会被转成UTF-8。",
			"an unknown":"未知",
			"Save to create the file":"保存后将创建此文件",
			"Replacing @1%...":"正在替换 (@1%)……",
			"Saving @1%...":"正在保存 (@1%)……",
			"Failed to save it":"保存失败",
			"You cannot save a file before it finishes loading":"在文件加载完成前不能保存",
			"Cannot create a temporary file for saving":"未能创建保存所需的临时文件",
			"Loading @1%...":"载入中 (@1%)……",
			"fuzzy search":"模糊查找",
			"Select &all":"全选(&A)",
			"&Copy":"复制(&C)",
			"Cu&t":"剪切(&T)",
			"&Paste":"粘贴(&P)",
			"Auto-complete":"自动完成",
			"&Find or replace...":"查找替换(&F)……",
			"Find in project...":"在工程中查找……",
			"Find previous / next":"查找上一个/下一个",
			"Find the current word":"查找当前单词",
			"&Go to...":"跳转到(&G)……",
			"Go to ... in project":"在工程中跳转……",
			"Go to &definition":"转到定义(&D)",
			"Find all references":"查找所有引用",
			"IT'S DELETED!\nSave your changes to dismiss this":"文件已遭删除！\n如欲消除此通知，请保存文件",
			"FILE CHANGED OUTSIDE!\n - Use File-Revert to reload\n - Save your changes to dismiss this":"文件已被其他程序修改！\n- 如欲重新加载，请选择“文件-放弃修改”\n- 如欲消除此通知，请保存文件",
			"Save the file for the language change to take effect":"如欲启用新语言，请先保存文件",
			"This cell is already running. Repeat your action to cancel it and re-run.":"这个脚本已经在运行了。如果想要终止重来，请再重复一遍刚才的动作。",
			"&New cell":"新建脚本(&N)",
			"&Run cell":"运行脚本(&R)",
			"&Delete cell":"删除脚本(&D)",
			"&New":"新建(&N)",
			"&Open":"打开(&O)",
			"&Save":"保存(&S)",
			"Save &as...":"另存为(&A)……",
			"Downlo&ad as file":"作为文件下载(&A)",
			"Save a&ll":"全部保存(&L)……",
			"&Close":"关闭(&C)……",
			"Close all":"全部关闭",
			"Close all but this":"除此之外全部关闭",
			"Revert changes":"放弃修改",
			"Recent / projec&t...":"文件列表(T)……",
			"Manage projects...":"管理工程列表……",
			"Restore closed":"恢复刚刚关闭的窗口",
			"Open shell (&D)...":"打开控制台窗口(&D)……",
			"E&xit":"退出(&X)",
			"Preferences...":"选项……",
			"&Copy path":"复制文件名",
			"Move related tabs to front":"把相关的文件挪到前面",
			"Open shell here (&D)...":"在此打开控制台窗口(&D)……",
			"Show in folder...":"在文件夹中显示……",
			"Return to file":"返回文件",
			"&Notebook...":"脚本簿(&N)……",
			"Note&book":"脚本簿(&B)",
			"&Help...":"帮助(&H)……",
			"Zoom (@1%)":"放缩 (@1%)",
			"Create file cell":"为该文件建立脚本",
			"Create project cell":"为整个工程建立脚本",
			"Build / &run file":"编译/运行该文件(&R)",
			"Build / run project":"编译/运行整个工程",
			"&Stop all cells":"停止所有脚本(&S)",
			"Smart paste":"智能粘贴",
			"Check &spelling":"检查拼写(&S)",
			"Auto &wrap":"自动换行(&W)",
			"Cut &line":"剪切整行(&L)",
			"Delete word":"删除单词",
			"Toggle c&omment":"注释/撤销(&O)",
			"&Indent selection":"增加缩进(&I)",
			"&Dedent selection":"减少缩进(&D)",
			"Scope":"缩进",
			"Lines of the same indentation":"缩进相同的行",
			"Set &bookmark":"设置书签(&B)",
			"Go to point of interest":"跳转到重要位置",
			"Select to point of interest":"选择到重要位置",
			"Parenthesis":"括号",
			"Fo&ld":"折叠(&L)",
			"U&nfold":"展开(&L)",
			"Wide char ↔ \\u":"宽字符 ↔ \\u",
			"Navigate":"历史导航",
			"Leading &tabs to spaces":"行首TAB转到空格(&T)",
			"Leading &spaces to tabs":"行首空格转到TAB(&S)",
			"Letters to &UPPERCASE":"字母变大写(&U)",
			"Letters to &lowercase":"字母变小写(UL)",
			"Line endings to &DOS":"变成&DOS换行",
			"Line endings to Uni&x":"变成Uni&x换行",
			"Escape C string":"处理C字符串用特殊字符",
			"Escape URL query string":"处理网址用特殊字符",
			"Unescape URL query string":"解码网址用特殊字符",
			"Searching ...":"搜索中……",
			"Listing project files...":"正在制作工程文件列表……",
			"All files searched":"所有文件搜索完毕",
			"Searching @1%":"搜索中(@1%)……",
			"Go to line @1":"跳转到第@1行",
			"Replaced @1 matches":"一共替换了@1处",
			"Nothing replaced above":"上面没有找到可以替换的地方",
			"Nothing replaced below":"下面没有找到可以替换的地方",
			"Parsing project @1...":"正在解析工程@1……",
			"Searching @1...":"正在搜索@1……",
			"Searching '@1' @2%":"正在搜索@1(@2%)……",
			"Create new file":"创建新文件",
			"Type to search or browse":"在此键入搜索字符串或路径",
			"Definition @1 of @2":"第@1处定义，共@2处",
			"Previous definition":"上一处定义",
			"Next definition":"下一处定义",
			"Install shell menu integration":"安装",
			"Dark theme / light theme":"切换黑/白界面",
			"Adjust tab width":"TAB宽度",
			"Highlight the current line":"高亮光标行",
			"Show the menu bar":"显示菜单栏",
			"Show horizontal scroll-bar":"显示横向滚动条",
			"Show outer scope overlays":"在上方显示外层缩进",
			"Show line numbers":"显示行号",
			"Show minimap":"显示缩略图",
			"Auto-hide minimap":"自动隐藏缩略图",
			"Customize the key mapping script":"定制热键脚本",
			"Make @1 stop at both sides":"@1在单词两侧同时有效",
			"Allow \u2190/\u2192 to cross lines":"允许←/→跨行",
			"Move forward old tabs when manually opened":"手动打开编辑中文件时前移窗格",
			"Notify when a notebook cell completes":"在脚本执行结束后提供通知",
			"Create FBO for linear rendering":"使用FBO进行线性渲染",
			"Enable smart repainting":"打开智能重绘",
			"Customize the theme script":"定制界面脚本",
			"Customize the translation script":"定制翻译脚本",
			"Preferences":"设置",
			"Search":"搜索",
			"the code failed to run":"运行失败",
			"code copied to clipboard":"已复制到剪贴板",
			"you need a window open for find to work":"没有编辑窗口，无法查找",
			"Save":"保存",
			"Cancel":"取消",
			"Edit with &QPad":"用&QPad编辑",
			"QPad Editor":"QPad编辑器",
			"QPad Text Editor":"QPad编辑器",
			'Restore tab size - F11':"恢复窗格大小 - F11",
			//"&Browse...":"",
			//"&select to":"",
			"Edit the match to start replacing":"如要进行替换，请编辑找到的文字",
			"Unpin this project":"忘记此工程",
			"Forget this file":"忘记此文件",
			"Refresh":"刷新",
			"Prev - SHIFT+CTRL+D":"前一个 - SHIFT+CTRL+D",
			"All - ALT+A":"全部 - ALT+A",
			"Next - CTRL+D":"后一个 - CTRL+D",
			"Case sensitive - ALT+C":"大小写敏感 - ALT+C",
			"Whole word - ALT+H":"只搜索整个单词 - ALT+H",
			"Regular expression - ALT+E":"正则表达式 - ALT+E",
			"Convert to wildcard - ALT+LEFT":"转换成通配符 - ALT+LEFT",
			"Code only - ALT+D":"只搜索代码 - ALT+D",
			"Search hidden text - ALT+T":"搜索隐藏文字 - ALT+T",
			"Close - ESC":"关闭 - ESC",
			"Prev - SHIFT+F3":"上一个 - SHIFT+F3",
			"Next - F3":"下一个 - F3",
			"Prev - SHIFT+CTRL+F3":"上一个 - SHIFT+CTRL+F3",
			"Next - CTRL+F3":"下一个 - CTRL+F3",
			"Delete cell":"删除脚本",
			"Move down":"向下移动",
			"Move up":"向上移动",
			"Add cell below":"在下面添加一个脚本",
			"Stop":"停止",
			"Run cell":"运行脚本",
			"Clear output":"清除输出",
			"Menu":"菜单",
			"Outer - ALT+PGUP":"外层 - ALT+PGUP",
			"Inner - ALT+PGDN":"内层 - ALT+PGDN",
			"Prev - ALT+UP":"上一行 - ALT+UP",
			"Next - ALT+DOWN":"下一行 - ALT+DOWN",
			"Prev - SHIFT+F2":"上一处 - SHIFT+F2",
			"Next - F2":"下一处 - F2",
			"Prev":"上一个",
			"Next":"下一个",
			"Go to matching - CTRL+P":"跳转到匹配括号 - CTRL+P",
			"Select between - SHIFT+CTRL+P":"选择括号间内容 - SHIFT+CTRL+P",
			"Back - CTRL+ALT+MINUS":"后退 - CTRL+ALT+MINUS",
			"Forward - CTRL+ALT+PLUS":"前进 - CTRL+ALT+PLUS",
			'  \u2193 regexp \u2193':'  \u2193 正则表达式 \u2193',
			"Plain text":"纯文本",
			"Binary":"二进制",
			"Auto-completion":"自动完成",
			"Show parameter hint":"显示函数参数帮助",
			"Error overlays":"错误标注",
			"Build and run":"编译运行",
			"Auto-indent":"自动缩进",
			"Advanced auto-indent":"高级自动缩进",
			"Enable spell checks":"拼写检查",
			"Enable auto wrap":"自动换行",
			"Line / word deletion":"删除一行/一个单词",
			"Comment / uncomment":"注释/取消注释",
			"Tab indent / dedent":"使用TAB键操作缩进",
			"Moving across scopes":"在缩进间移动",
			"Keyboard scrolling":"键盘滚动",
			"Bookmarks":"书签",
			"Points of interest":"重要位置",
			"Show matching parenthesis":"显示配对括号",
			"Auto-complete parenthesis":"自动配对括号",
			"Auto-strip trailing spaces":"自动去除行尾空格",
			"Text folding":"文字折叠",
			"Automatic edit propagation":"自动扩散编辑",
			"Cursor history navigation":"光标前进/后退",
			"Show changed lines in scrollbar":"在滚动条上显示修改区域",
			"No more '@1' above":"上面没有别的'@1'了",
			"No more '@1' below":"下面没有别的'@1'了",
			"No more matches above":"上面找不到别的了",
			"No more matches below":"下面找不到别的了",
			"Search a JS expression, e.g. 'MZ' or [0x4d,0x5a]":"请搜索JS表达式，例如'MZ'或[0x4d,0x5a]",
			"Address: ":"地址：",
			"Found one":"找到了",
			"Bad search expression: ":"非法搜索表达式：",
			"The search expression has to be a string or a buffer":"搜索表达式只能是字符串或者数组",
			"Bad value expression: ":"非法值：",
			"Save and reload to reopen it in the text editor":"要切换到文本模式，请保存该文件并重新打开",
			"Bad address: ":"非法地址：",
			//"@1:@2":"",
			"@1:@2 Yesterday":"昨天@1:@2",
			//"@1/@2/@3":"",
			//"U+@1":"",
			"@1 lines, @2 words, @3 chars, @4 bytes":"@1行，@2个单词，@3个字符，@4个字节",
			"Ln @1,@2-@3":"@1行@2-@3列",
			"Ln @1,@2-@3,@4":"@1行@2列-@3行@4列",
			"Ln @1,@2":"@1行@2列",
			"Output - @1":"输出 - @1",
			"@1 - Notebook":"@1 - 脚本簿",
			"@1 (running)":"@1 (运行中)",
			"Use QPad to open *.@1":"用QPad打开所有@1文件",
			//"Markdown":""
			///////////////////
			'GLSL shader':'GLSL着色器',
			'HLSL shader':'HLSL着色器',
			'TeX bibliography':'TeX参考文献',
			'Unix Shell Script':'Unix脚本',
			///////////////////
			'"@1" is ':'“@1”',
			'@1 in @2, ':'按@2类型看是“@1”，',
			'or @1 in @2. ':'按@2类型看是“@1”。',
			"Auto-detected repositories":"自动检测到的工程",
			"Help":"帮助",
			"Projects":"工程",
			"Google “@1”":"用Google搜索“@1”",
			"Wiktionary entry for “@1”":"在维基词典上查阅“@1”",
			"“@1” for Apple developers":"在Apple开发者页面上搜索“@1”",
			"“@1” on MSDN":"在MSDN上搜索“@1”",
			"Android class “@1”":"Android类“@1”",
			"Node.js package “@1”":"Node.js软件包“@1”",
			"Google for “@1”":"用Google搜索“@1”",
			"https://en.wiktionary.org/wiki/文":"https://zh.wiktionary.org/wiki/文",
			"Loading '@1' @2%":"正在载入@1(@2%)",
			"'@1' is not a part of any known project":"“@1”并不属于任何一个已知的工程",
			"Output (running...)":"输出 (正在运行……)",
			"Output":"输出",
			"All files searched, found @1":"所有文件搜索完毕，共找到@1处",
			"Cannot find a definition of '@1'":"找不到'@1'的定义",
			"the file doesn't exist":"文件不存在",
			"It's not saved yet...":"还没存呢……",
			"Don't save":"不存",
			"Parsing @1, @2 files left...":"正在解析@1，还剩@2个文件……",
			"in project '@1'":"在工程'@1'中查找",
			"Run project":"运行工程",
			"&Find...":"查找(&F)……",
			"Go to bookmark":"转到书签",
			"Select to bookmark":"选择到书签",
			"Bad width: ":"非法宽度：",
			"Highlight find at the scrollbar":"在滚动条上标出查找结果",
			"No more '@1' below, found @2":"下面没有别的'@1'了，共@2个",
			"Automatically close stale tabs":"自动关闭很久没用的窗格",
			"Highlight same-project tabs":"高亮同一工程的窗格",
			"Parameters":"参数",
			"Returns":"返回值",
			"In @1:":"在@1中：",
			"Display":"显示",
			"Controls":"操作",
			"Editing":"编辑",
			"Tools":"工具",
			"About":"关于",
			"Open Source Licenses":"开源授权",
			"Font Licenses":"字体授权",
			"QPad v@1, by Qiming HOU":"QPad版本@1，侯启明",
			"Contact: hqm03ster@gmail.com":"邮箱：hqm03ster@gmail.com",
			"&Clone cell":"克隆脚本(&C)",
			"Clear &output":"清除输出(&O)",
			"Auto-hide the \"Files\" tab":"自动隐藏文件列表",
			"Add cell":"新建脚本",
			"Default Notebook":"默认脚本簿",
			"It's still running...":"还在运行呢……",
			"Stop it":"强行停止",
			"Press any key to continue...":"按任意键继续……",
			"@1 (@2%)":"@1 (@2%)",
			"Bad theme:\n  ":"主题文件有错：\n  ",
			"Auto-switch notebooks":"自动切换脚本簿",
			"Customize the theme":"定制界面主题",
			"Undo - CTRL+Z":"撤销 - CTRL+Z",
			"Redo - SHIFT+CTRL+Z":"重做 - SHIFT+CTRL+Z",
			"Go to - CTRL+G":"跳转到 - CTRL+G",
			"Save - CTRL+S":"保存 - CTRL+S",
			"Run - CTRL+F5":"运行 - CTRL+F5",
			"O&pen a similar tab":"打开一个一样的窗格(&P)",
			"&Peek definition":"开个小窗口查看定义(&P)",
			"EXTERNAL CHANGES LOADED!\n - Use Edit-Undo to revert\n - Make more changes to dismiss this":"刚刚加载了外部做出的修改！\n- 要想撤销这些修改，请选择“编辑-撤销”\n- 如欲消除此通知，接着往下编辑就好",
			"Set cell mode":"设置脚本运行模式",
			"Install remote editing feature":"安装远程编辑功能",
			"Install SSH public key":"安装SSH公钥",
			"Waiting for response...":"正在等待远程终端响应……",
			"Uploading to the terminal...":"正在上传到远程终端……",
			"THE TERMINAL HAS BEEN CLOSED!\nCan't upload anymore. Save your changes under another name before it's lost.":"远程终端已被关闭！\n已经不能再上传了。如果想要保留编辑内容，请另存一个文件。",
			"Open new terminal...":"打开新的终端窗口……",
			"View source (&R)...":"返回源文件(&R)...",
			"View formatted (&R)...":"查看效果(&R)...",
			"You need to select the text to replace first":"请先选中希望替换的文字",
			"Place function info at the cursor":"在光标位置显示函数帮助",
			"Add node":"添加节点",
			"Terminal":"终端窗口",
			"Commit: @1":"Commit号: @1",
			"Pin '@1' to this menu":"将'@1'固定到这个菜单",
			"@1 (stopped)":"@1 (已停止)",
			"@1 (remote)":"@1 (远程文件)",
			"Uploading @1%...":"上传中 (@1%)……",
			"New window":"新窗口",
			"New tab":"新的终端窗格",
			"Interactive terminal":"带交互的小终端",
			"Simple terminal":"不带交互的小终端",
			"Connect":"连接",
			"Unpin":"取消固定",
			"It's still connected...":"还连着呢……",
			"Hang up":"断开",
			"Remote editing of binary files is not supported yet":"目前还无法远程编辑二进制文件",
			"You cannot switch language while loading or saving a file":"无法在载入或保存的途中改变语言",
			"New sticker wall":"新建贴纸墙",
			"Copy as sticker":"作为贴纸复制",
			"This cell doesn't have a name yet, use '[button: ...]' to specify one.":"该脚本还没有标题，请用'[button: ...]'添加一个。",
			"@1 (Sticker wall)":"@1 (贴纸墙)",
			"Add note - CTRL+M":"新建笔记 - CTRL+M",
			"Add group - SHIFT+CTRL+M":"新建编组框 - SHIFT+CTRL+M",
			"Cut stickers - SHIFT+CTRL+X":"剪切贴纸 - SHIFT+CTRL+X",
			"Paste - CTRL+V":"粘贴 - CTRL+V",
			"Bigger font - SHIFT+CTRL+'+'":"加大字体 - SHIFT+CTRL+'+'",
			"Smaller font - SHIFT+CTRL+'-'":"减小字体 - SHIFT+CTRL+'-'",
			"Go to original - CTRL+ALT+G":"转到原始代码 - CTRL+ALT+G",
			/////////////////////
			"Set caption text":"设置标题文字",
			"Set hotkey":"设置热键",
			"Tag not found":"标记未找到",
			"The script has to be a Javascript function that takes a string and returns a string":"编辑脚本必须是一个接收字符串并返回字符串的Javascript函数",
			"This cell can only be run within another active editor":"这个脚本只能在开着其他编辑窗口的情况下运行",
			"Restore tab size":"还原",
			"Maximize tab":"最大化",
			"Run notebook cell '@1'":"运行脚本'@1'",
			"Use in an editor":"用于编辑其他窗口里的文字",
			"Paste":"粘贴",
			"Find...":"查找……",
			"Enable hotkeys in terminals":"在终端窗口里启用编辑热键",
			"Receive development updates":"接收开发版更新",
			"Version @1 is available - Update":"版本@1已经出了 - 自动升级",
			"Your QPad is up to date - Update":"已经是最新版了 - 自动升级",
			"Install MSYS2 to enable terminal tabs and auto-update":"安装MSYS2才能启用终端窗口和自动升级",
			"time unavailable":"未能获取时间",
			"Search stackoverflow for “@1”":"在stackoverflow上查找“@1”",
			"Full-tab terminal":"占满窗格",
			"Copy command":"复制命令",
			"# Release Notes":"# 更新历史",
			"[button: Update now!]":"[button: 马上升级！]",
		},
	};
	g_translations["zh_tw"]=g_translations["zh_cn"];//coulddo: do zh_tw
	var g_month_days={};
	var fkanji_monthday=function(month,day){
		return (month+1).toString()+"月"+(day+1).toString()+"日";
	}
	g_month_days["zh_cn"]=fkanji_monthday;
	g_month_days["zh_tw"]=fkanji_monthday;
	g_month_days["ja_jp"]=fkanji_monthday;
	//////////////////////
	var s_env_lang=IO.GetEnvironmentVariable("LANG");
	if(s_env_lang){
		var pdot=s_env_lang.indexOf('.');
		if(pdot>=0){
			s_env_lang=s_env_lang.substr(0,pdot);
		}
		s_env_lang=s_env_lang.toLowerCase();
		if(!g_translations[s_env_lang]){
			s_env_lang=undefined;
		}
	}
	UI.m_ui_language=(s_env_lang||IO.GetUserLanguage&&IO.GetUserLanguage()||"en_us");
	if(UI.TestOption("force_english",0)){
		UI.m_ui_language="en_us";
	}
	UI.m_translation=g_translations[UI.m_ui_language]||g_translations["en_us"]||{};
	var fmonth_day=g_month_days[UI.m_ui_language];
	if(fmonth_day){
		UI.MonthDay=fmonth_day;
	}
	//////////////////////
	if(UI.Platform.ARCH=="win32"||UI.Platform.ARCH=="win64"){
		if(UI.m_ui_language=="ja_jp"){
			UI.fallback_font_names=["meiryo.ttc","msgothic.ttc","arialuni.ttf"]
		}else{
			UI.fallback_font_names=["msyh.ttc","msyh.ttf","simhei.ttf","arialuni.ttf"]
		}
	}else if(UI.Platform.ARCH=="mac"){
		UI.fallback_font_names=["STHeiti Medium.ttc","LastResort.ttf"]
	}else if(UI.Platform.ARCH=="android"){
		UI.fallback_font_names=["DroidSansFallback.ttf"]
	}else{
		if(UI.m_ui_language=="ja_jp"){
			UI.fallback_font_names=["cjk_fonts/dsansja.ttf"]
		}else{
			UI.fallback_font_names=["cjk_fonts/dsanscn.ttc"]
		}
	}
	////////////////////////////
	if(UI.Platform.BUILD=="debug"){
		var s_translations=IO.ReadAll("build/translation.txt");
		if(s_translations){
			var taboos=['16','32','48','64','confirm','IT','100%',"&Browse...","&select to","- or ,","ENTER or SPACE","= or .","CTRL -","CTRL+0","CTRL +",
				"@1:@2",
				"@1/@2/@3",
				"U+@1",
				"Markdown"];
			var all_translatable_strings=[];
			var dedup={};
			var taboo={};
			for(var i=0;i<taboos.length;i++){
				taboo[taboos[i]]=1;
			}
			s_translations.replace(/['"](.*)['"]/g,function(swhole,stext0){
				var stext=stext0.replace(/\\n/g,'\n')
				if(!dedup[stext]&&stext.length>1&&stext.indexOf('_')<0&&stext.indexOf('\\u')<0&&!taboo[stext]){
					all_translatable_strings.push(stext);
					dedup[stext]=1;
				}
			});
			var dump={};
			for(var slang in g_translations){
				if(slang!="en_us"){
					var translation_i=g_translations[slang];
					if(translation_i["$$$"]){continue;}
					translation_i["$$$"]=1;
					var pendings={};
					for(var i=0;i<all_translatable_strings.length;i++){
						var s=all_translatable_strings[i];
						if(!translation_i[s]){
							pendings[s]="";
							dump[slang]=pendings;
						}
					}
				}
			}
			IO.CreateFile("build/translation.json",JSON.stringify(dump).replace(/,/g,",\n\t"));
		}
	}
})();
