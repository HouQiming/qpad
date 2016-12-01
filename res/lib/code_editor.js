var UI=require("gui2d/ui");
var W=require("gui2d/widgets");
require("res/lib/global_doc");
var Language=require("res/lib/langdef");
var MAX_PARSABLE=33554432
var TOK_TYPE=0x20000000
var KEY_DECL_CLASS=TOK_TYPE*1
var KEY_DECL_FUNCTION=TOK_TYPE*0
var CALL_GC_DOC_SIZE_THRESHOLD=4194304;
var GRACEFUL_WORD_SIZE=256;
var MAX_MATCHES_IN_GLOBAL_SEARCH_RESULT=256;
var MAX_ALLOWED_INDENTATION=20;//has to match the similarly-named const in code-editor.jc
var MAX_HIGHLIGHTED_MATCHES=1024;
var MAX_HISTORY_ITEMS=20;

UI.m_code_editor_persistent_members_doc=[
	"m_language_id",
	"m_current_wrap_width",
	"m_enable_wrapping",
	/////////
	"m_hyphenator_name",
	"m_spell_checker",
	"m_is_help_page_preview",
]
UI.RegisterCodeEditorPersistentMember=function(name){
	UI.m_code_editor_persistent_members_doc.push(name)
}
UI.m_editor_plugins=[];
UI.RegisterEditorPlugin=function(fplugin){
	UI.m_editor_plugins.push(fplugin)
	return fplugin
}
UI.m_special_files=[];
UI.RegisterSpecialFile=function(fn,obj){
	UI.m_special_files[fn]=obj;
}

///////////////////////////////////////////////////////
//the code editor
var g_encoding_names={
	'0':"an unknown",
	'1':"the ISO-8859-1",
	'2':"the UTF-8",
	'3':"the GBK",
	'4':"the Shift-JIS",
	'5':"the Big-5",
	'7':"the UTF-16",
}
W.ACContext_prototype={
	GetDisplayItem:function(id){
		var ret=this.m_display_items[id]
		if(!ret){
			//UI.assert(id==this.m_display_items.length,"panic: not doing acctx sequentially")
			var cc=this.m_accands.at(id);
			//ignore weight for now: cc.weight
			ret={
				x:this.m_x_current,
				w:UI.MeasureText(UI.default_styles.code_editor.accands_font,cc.name).w,
				name:cc.name,
				brief:cc.brief,
			}
			this.m_x_current+=ret.w+UI.default_styles.code_editor.accands_padding
			this.m_display_items[id]=ret
		}
		return ret
	},
	IDFromX:function(x){
		while(this.m_x_current<x&&this.m_display_items.length<this.m_n_cands){
			this.GetDisplayItem(this.m_display_items.length)
		}
		var dis=this.m_display_items
		var l=0;
		var r=dis.length-1
		while(l<=r){
			var m=(l+r)>>1
			if(dis[m].x<=x){
				l=m+1
			}else{
				r=m-1
			}
		}
		return Math.max(r,0)
	},
};
var NewACContext=function(ret){
	Object.setPrototypeOf(ret,W.ACContext_prototype);
	ret.m_scroll_i=0;
	ret.m_display_items=[];
	ret.m_n_cands=(ret.m_accands?ret.m_accands.length:0);
	ret.m_x_current=UI.default_styles.code_editor.accands_padding*0.5;
	ret.m_brief_cache={};
	ret.m_selection=0;
	return ret;
};
W.CodeEditor_prototype=UI.InheritClass(W.Edit_prototype,{
	tab_is_char:1,
	ignore_newline_before_for_down:1,
	plugin_class:'code_editor',
	state_handlers:["renderer_programmer","colorer_programmer","line_column_unicode","seeker_indentation"],
	//state_handlers:["renderer_fancy","colorer_programmer","line_column_unicode","seeker_indentation"],
	////////////////////
	//per-language portion
	//language:g_language_C,
	AddAdditionalPlugins:function(){
		var plugins=UI.m_editor_plugins;
		for(var i=0;i<plugins.length;i++){
			var fplugin=plugins[i];
			if(fplugin.prototype.desc){
				if(!UI.TestOption(fplugin.prototype.desc.stable_name)){continue;}
			}
			fplugin.call(this)
		}
	},
	LoadMetaData:function(){
		return this.m_file_name&&UI.m_ui_metadata[this.m_file_name]||{};
	},
	Init:function(){
		this.m_event_hooks={}
		this.m_event_hooks['load']=[]
		this.m_event_hooks['save']=[]
		this.m_event_hooks['close']=[]
		this.m_event_hooks['parse']=[]
		this.m_event_hooks['menu']=[]
		this.m_event_hooks['render']=[]
		this.m_event_hooks['wrap']=[]
		this.m_event_hooks['global_menu']=[]
		this.m_event_hooks['beforeEdit']=[]
		this.m_event_hooks['autoComplete']=[]
		this.m_event_hooks['explicitAutoComplete']=[]
		//before creating the editor, try to call a language callback
		var loaded_metadata=this.LoadMetaData()
		var hyp_name=(loaded_metadata.m_hyphenator_name||this.plugin_language_desc&&this.plugin_language_desc.default_hyphenator_name)
		if(this.plugin_language_desc&&!this.plugin_language_desc.default_hyphenator_name){
			hyp_name=undefined;
		}
		if(hyp_name){
			this.hyphenator=Language.GetHyphenator(hyp_name)
			this.m_hyphenator_name=hyp_name
			this.ignore_newline_before_for_down=0;
			this.font=this.tex_font
			this.font_emboldened=this.tex_font_emboldened
		}
		var spell_checker=(loaded_metadata.m_spell_checker||this.plugin_language_desc&&this.plugin_language_desc.spell_checker)
		if(spell_checker){
			this.m_spell_checker=spell_checker;
		}
		//if(UI.enable_timing){
		//	UI.TimingEvent('before W.Edit_prototype.Init');
		//}
		W.Edit_prototype.Init.call(this);
		//if(UI.enable_timing){
		//	UI.TimingEvent('after W.Edit_prototype.Init');
		//}
		//these are locators when set
		this.m_bookmarks=[undefined,undefined,undefined,undefined,undefined,undefined,undefined,undefined,undefined,undefined];
		this.m_unkeyed_bookmarks=[];
		if(this.m_is_main_editor){
			this.m_diff_from_save=this.ed.CreateDiffTracker()
			if(this.m_file_name){
				this.StartLoading(this.m_file_name)
			}
			//main editor things
			//this.OnBlur=function(){
			//	var obj=this.owner
			//	if(!obj){return;}
			//	if(obj.m_current_find_context){
			//		obj.m_current_find_context.CancelFind();
			//	}
			//}
			this.AddEventHandler('selectionChange',function(){
				//replace hint
				var obj=this.owner
				if(!obj||obj.read_only){return;}
				var show_replace_hint=0
				if(obj.m_current_find_context&&!obj.m_replace_context&&!obj.m_no_more_replace){
					var ccnt=this.sel1.ccnt
					var ctx=obj.m_current_find_context;
					var match_id=ctx.BisectMatches(this,ccnt)
					if(match_id){
						var match_ccnt0=ctx.GetMatchCcnt(match_id,0)
						var match_ccnt1=ctx.GetMatchCcnt(match_id,1)
						if(match_ccnt0<=ccnt&&ccnt<=match_ccnt1&&match_ccnt0<=this.sel0.ccnt&&this.sel0.ccnt<=match_ccnt1){
							show_replace_hint=1
						}
					}
				}
				if(show_replace_hint){
					obj.CreateNotification({
						id:'replace_hint',icon:'换',text:UI._('Edit the match to start replacing')
					},"quiet")
				}else{
					obj.DismissNotification('replace_hint')
				}
				UI.g_goto_definition_context=undefined;
				this.m_hide_prev_next_buttons=1;
			})
			this.AddEventHandler('beforeEdit',function(ops){
				var obj=this.owner
				if(!obj){return;}
				if(obj.m_current_find_context&&ops.length>0&&!obj.m_replace_context&&!obj.m_no_more_replace){
					var ctx=obj.m_current_find_context;
					var match_id=ctx.BisectMatches(this,ops[0])
					if(match_id){
						var match_ccnt0=ctx.GetMatchCcnt(match_id,0)
						var match_ccnt1=ctx.GetMatchCcnt(match_id,1)
						var intersected=1;
						for(var i=0;i<ops.length;i+=3){
							var ccnt0_i=ops[i]
							var ccnt1_i=ops[i]+ops[i+1]
							if(!(ccnt0_i<=match_ccnt1&&ccnt1_i>=match_ccnt0)){
								intersected=0;
								break
							}
							//m_user_just_typed_char is updated after this, we can test it here for the previous state
							if(this.m_user_just_typed_char&&ccnt0_i==match_ccnt1){
								//the user types a new copy of the needle, then continues typing
								//it SHOULD NOT count as an auto-replace attempt
								intersected=0;
								break
							}
						}
						if(intersected){
							//start replacing - *every* op intersects with the match...
							obj.SetReplacingContext(match_ccnt0,match_ccnt1)
							if((obj.m_current_find_context.m_flags&UI.SEARCH_FLAG_REGEXP)&&UI.TestOption("auto_edit")){
								var match_ccnts=UI.ED_AutoEdit_RegexpMatch(
									obj.doc.ed,match_ccnt0,match_ccnt1,
									obj.m_current_find_context.m_needle,
									obj.m_current_find_context.m_flags);
								if(match_ccnts){
									var rctx=obj.m_replace_context;
									rctx.m_ae_raw_text=obj.doc.ed.GetText(match_ccnt0,match_ccnt1-match_ccnt0);
									rctx.m_ae_ctx=UI.ED_AutoEdit_RegexpCtxCreate(
										obj.doc.ed,match_ccnts);
								}
							}
						}else{
							obj.m_no_more_replace=1;
						}
					}else{
						if(obj.m_current_find_context){
							obj.m_no_more_replace=1;
						}
					}
				}
			})
			this.AddEventHandler('change',function(){
				var renderer=this.ed.GetHandlerByID(this.ed.m_handler_registration["renderer"]);
				renderer.m_hidden_ranges_prepared=0
				///////////
				var obj=this.owner
				if(!obj){return;}
				obj.DestroyFindingContext()
				if(obj.m_replace_context){
					var rctx=obj.m_replace_context;
					var match_ccnt0=rctx.m_locators[0].ccnt;
					var match_ccnt1=rctx.m_locators[1].ccnt;
					if(rctx.m_ae_ctx){
						var srep_ccnt0=rctx.m_locators[0].ccnt
						var srep_ccnt1=rctx.m_locators[1].ccnt
						if(srep_ccnt0<srep_ccnt1){
							s_replace=this.ed.GetText(srep_ccnt0,srep_ccnt1-srep_ccnt0)
						}else{
							s_replace='';
						}
						var prg_tbl=UI.ED_AutoEdit_RegexpCtxSetExample(rctx.m_ae_ctx,s_replace);
						rctx.m_ae_prg=undefined;
						rctx.m_ae_match_table=undefined;
						if(prg_tbl){
							rctx.m_ae_prg=prg_tbl.m_prg;
							rctx.m_ae_match_table=prg_tbl.m_match_table;
						}
					}
				}
			})
			this.AddEventHandler('ESC',function(){
				this.CancelAutoCompletion()
				this.m_ac_activated=0
				this.m_user_just_typed_char=0
				this.m_fhint_ctx=undefined;
				var renderer=this.GetRenderer();
				renderer.RemoveAllEmbeddedObjects();
				//////////
				var obj=this.owner
				if(!obj){return;}
				obj.m_notifications=[]
				obj.DestroyReplacingContext();
				//obj.hide_sxs_visualizer=!obj.hide_sxs_visualizer;
				//if(!obj.m_sxs_visualizer){
				//	obj.hide_sxs_visualizer=0;
				//}
				obj.DestroyFindingContext()
				obj.m_hide_find_highlight=1
				if(obj.doc&&obj.doc.notebook_owner){
					var tab_frontmost=UI.GetFrontMostEditorTab();
					if(tab_frontmost){
						UI.top.app.document_area.SetTab(tab_frontmost.__global_tab_id)
					}
				}else{
					UI.top.app.document_area.ToggleMaximizeMode();
				}
				UI.g_goto_definition_context=undefined;
				UI.Refresh()
				return 1
			})
			//current line highlight
			var hl_items=this.CreateTransientHighlight({'depth':-100,'color':this.color_cur_line_highlight,'invertible':0});
			this.cur_line_p0=hl_items[0]
			this.cur_line_p1=hl_items[1]
			this.cur_line_hl=hl_items[2]
			var line_current=this.GetLC(this.sel1.ccnt)[0]
			var ed_caret=this.GetCaretXY();
			if(UI.TestOption("show_line_highlight")){
				this.cur_line_p0.ccnt=this.SeekXY(0,ed_caret.y);
				this.cur_line_p1.ccnt=this.SeekXY(1e17,ed_caret.y);
			}else{
				this.cur_line_p0.ccnt=0;
				this.cur_line_p1.ccnt=0;
			}
		}
	},
	OnDestroy:function(){
		this.CallHooks('close')
		this.m_is_destroyed=1;
		//break the connections for rc
		this.m_ac_context=undefined;
		this.ed=undefined;
	},
	ResetSaveDiff:function(){
		if(this.m_diff_from_save){
			this.m_diff_from_save.discard()
			this.m_diff_from_save=this.ed.CreateDiffTracker()
		}
	},
	FindNearestBookmark:function(ccnt,direction){
		//just do a sequential search
		var best=undefined,best_bm=undefined;
		for(var i=0;i<10;i++){
			var bm=this.m_bookmarks[i]
			if(!bm){continue;}
			var dist=(bm.ccnt-ccnt)*direction;
			if(dist>=0&&!(best<dist)){
				best=dist
				best_bm=bm;
			}
		}
		for(var i=0;i<this.m_unkeyed_bookmarks.length;i++){
			var bm=this.m_unkeyed_bookmarks[i];
			if(!bm){continue;}
			var dist=(bm.ccnt-ccnt)*direction;
			if(dist>=0&&!(best<dist)){
				best=dist
				best_bm=bm;
			}
		}
		return best_bm;
	},
	DeleteBookmark:function(bm){
		//just do a sequential search
		bm.discard()
		for(var i=0;i<10;i++){
			if(bm==this.m_bookmarks[i]){
				this.m_bookmarks[i]=undefined;
				return;
			}
		}
		for(var i=0;i<this.m_unkeyed_bookmarks.length;i++){
			if(bm==this.m_unkeyed_bookmarks[i]){
				this.m_unkeyed_bookmarks[i]=undefined;
				return;
			}
		}
	},
	////////////////////
	//overloaded methods
	StartLoading:function(fn){
		var ed=this.ed;
		var is_preview=this.m_is_preview
		this.m_loaded_time=IO.GetFileTimestamp(fn)
		if(this.owner){this.owner.DismissNotification('saving_progress');}
		if(fn.length&&fn[0]=='*'){
			//built-in file
			var fn_special=fn.substr(1);
			var floader=(UI.m_special_files[fn_special]&&UI.m_special_files[fn_special].Load);
			var s_content="";
			if(floader){
				s_content=(floader()||"");
			}else{
				s_content=(IO.UIReadAll(fn_special)||"");
			}
			ed.Edit([0,0,s_content],1);
			//this.ResetSaveDiff()
			this.OnLoad()
			UI.Refresh();
			return;
		}
		ed.hfile_loading=UI.EDLoader_Open(ed,fn,is_preview?4096:(this.hyphenator?262144:4194304),function(encoding){
			if(this.owner){
				this.owner.CreateNotification({id:'saving_progress',icon:'警',
					text:UI._("The file was using @1 encoding. Should you save it, it will be converted to UTF-8 instead.").replace(
						"@1",g_encoding_names[encoding]||UI._("an unknown")),
				})
			}
			return 0
		}.bind(this))
		//abandonment should work as is...
		var floadNext=(function(){
			if(this.m_is_destroyed){
				if(ed.hfile_loading){
					ed.hfile_loading.discard()
					ed.hfile_loading=undefined
				}
				return
			}
			ed.hfile_loading=UI.EDLoader_Read(ed,ed.hfile_loading,is_preview?16384:(this.hyphenator?262144:4194304))
			if(this.m_owner){
				this.m_owner.m_is_rendering_good=0;
			}
			//this.ResetSaveDiff()
			if(is_preview){
				var rendering_ccnt1=this.SeekXY(0,this.h)
				if(rendering_ccnt1<ed.GetTextSize()){
					//abandon and stop loading without calling OnLoad
					if(ed.hfile_loading){
						ed.hfile_loading.discard()
						ed.hfile_loading=undefined
					}
					UI.Refresh()
					return
				}
			}
			if(ed.hfile_loading){
				UI.NextTick(floadNext);
			}else{
				//this.ResetSaveDiff()
				this.OnLoad()
			}
			UI.Refresh()
		}).bind(this)
		if(ed.hfile_loading){
			floadNext()
		}else{
			//this.ResetSaveDiff()
			this.OnLoad()
			if(!IO.FileExists(fn)&&!this.m_is_preview&&fn.indexOf('<')<0){
				this.saved_point=-1;
				if(this.owner){
					this.owner.CreateNotification({id:'saving_progress',icon:'新',text:"Save to create the file"})
				}
			}
		}
		UI.Refresh()
	},
	OnLoad:function(){
		var loaded_metadata=this.LoadMetaData()
		if(loaded_metadata.m_bookmarks){
			for(var i=0;i<10;i++){
				if(loaded_metadata.m_bookmarks[i]!='n/a'&&!this.m_bookmarks[i]){
					this.m_bookmarks[i]=this.ed.CreateLocator(Math.max(Math.min(loaded_metadata.m_bookmarks[i],this.ed.GetTextSize()),0))
				}
			}
		}
		if(loaded_metadata.m_unkeyed_bookmarks){
			var bm=loaded_metadata.m_unkeyed_bookmarks
			for(var i=0;i<bm.length;i++){
				this.m_unkeyed_bookmarks.push(this.ed.CreateLocator(Math.max(Math.min(bm[i],this.ed.GetTextSize()),0)))
			}
		}
		if(loaded_metadata.sel0){this.sel0.ccnt=Math.max(Math.min(loaded_metadata.sel0,this.ed.GetTextSize()),0);}
		if(loaded_metadata.sel1){this.sel1.ccnt=Math.max(Math.min(loaded_metadata.sel1,this.ed.GetTextSize()),0);}
		for(var i=0;i<UI.m_code_editor_persistent_members_doc.length;i++){
			var name_i=UI.m_code_editor_persistent_members_doc[i]
			var value_i=loaded_metadata[name_i];
			if(value_i!=undefined){this[name_i]=value_i;}
		}
		var renderer=this.ed.GetHandlerByID(this.ed.m_handler_registration["renderer"]);
		if(loaded_metadata.m_hidden_ranges){
			var ccnt_tot=this.ed.GetTextSize();
			for(var i=0;i<loaded_metadata.m_hidden_ranges.length;i+=2){
				if(loaded_metadata.m_hidden_ranges[i+1]<=ccnt_tot){
					renderer.HideRange(this.ed,loaded_metadata.m_hidden_ranges[i],loaded_metadata.m_hidden_ranges[i+1])
				}
			}
		}
		this.AutoScroll("center")
		this.scrolling_animation=undefined
		this.CallHooks("selectionChange")
		this.CallHooks("load")
		this.ParseFile()
		this.m_finished_loading=1
		var cbs=this.opening_callbacks
		if(cbs){
			for(var i=0;i<cbs.length;i++){
				cbs[i].call(this);
			}
			this.opening_callbacks=undefined
		}
		UI.Refresh()
	},
	ParseFile:function(){
		if(this.m_is_preview){return;}
		if(!this.m_file_name){return;}
		var sz=this.ed.GetTextSize()
		if(sz>MAX_PARSABLE||!UI.TestOption("enable_parser")){
			return;
		}
		UI.ED_ParserQueueFile(this.m_file_name)
		this.CallHooks("parse")
		CallParseMore()
		if(this.owner&&this.m_file_name){
			//parse one file *immediately*, hopefully it's our file and that's it
			//only do this for user-opened files
			//if(UI.enable_timing){
			//	UI.TimingEvent('onload parse of '+this.m_file_name);
			//}
			var ret=UI.ED_ParseMore();
			if(ret){
				var doc_arr=UI.g_editor_from_file[ret.file_name];
				if(doc_arr){
					doc_arr.forEach(function(doc){
						if(doc&&doc.ed){
							doc.ed.m_file_index=ret.file_index;
						}
					})
				}
			}
		}
	},
	//always go left
	GetBracketLevel:function(ccnt){
		var ed=this.ed;
		return ed.GetStateAt(ed.m_handler_registration["colorer"],ccnt,"ill")[1];
	},
	FindBracket:function(n_brackets,ccnt,direction){
		var ed=this.ed;
		var ret=ed.FindNearest(ed.m_handler_registration["colorer"],[0,n_brackets],"ll",ccnt,direction);
		return ret;
	},
	FindBracketSafe:function(n_brackets,ccnt,direction){
		var ret=this.FindBracket(n_brackets,ccnt,direction)
		if(ret==-1){
			if(direction<0){
				return 0;
			}else{
				return ed.GetTextSize();
			}
		}
		return ret;
	},
	FindOuterBracket:function(ccnt,direction){
		return this.FindBracket(this.GetBracketLevel(ccnt)-1,ccnt,direction);
	},
	IsBracketEnabledAt:function(ccnt){
		var lang=this.plugin_language_desc
		var ed=this.ed
		var enabled_mask=lang.m_inside_mask_to_enabled_mask[ed.GetStateAt(ed.m_handler_registration["colorer"],ccnt,"ill")[0]];
		return (enabled_mask&lang.m_bracket_enabling_mask)!=0
	},
	///////////////////////////////
	GetIndentLevel:function(ccnt){
		var ccnt_home=Math.min(this.GetEnhancedHome(ccnt),ccnt)
		return ccnt_home-this.ed.MoveToBoundary(ccnt_home,-1,"space");
	},
	FindOuterIndentation:function(ccnt){
		var lang=this.plugin_language_desc;
		if(lang.ignore_indentation){
			return -1;
		}
		var ed=this.ed;
		var id_indent=ed.m_handler_registration["seeker_indentation"]
		var my_level=this.GetIndentLevel(ccnt);
		return ed.FindNearest(id_indent,[Math.min(my_level,MAX_ALLOWED_INDENTATION)-1],"l",ccnt,-1);
	},
	///////////////////////////////
	BracketSizeAt:function(ccnt,side){
		//ccnt is at the last character of a token...
		var lang=this.plugin_language_desc
		if(!lang){return 1;}
		var tokens=(side==0?lang.m_lbracket_tokens:lang.m_rbracket_tokens)
		if(!tokens){return 1;}
		for(var i=0;i<tokens.length;i++){
			var s=tokens[i]
			var lg=Duktape.__byte_length(s)
			if(ccnt+1-lg>0&&this.ed.GetText(ccnt+1-lg,lg)==s){
				return lg
			}
		}
		return 1
	},
	FindOuterBracket_SizeFriendly:function(ccnt,delta){
		var ccnt_raw=this.FindOuterBracket(ccnt,delta)
		//return delta<0?ccnt_raw:(ccnt_raw+1-this.BracketSizeAt(ccnt_raw,0))
		return ccnt_raw<0?ccnt_raw:(ccnt_raw+1-this.BracketSizeAt(ccnt_raw,delta<0?0:1))
	},
	FindOuterLevel:function(ccnt){
		var ccnt_bracket=this.FindOuterBracket_SizeFriendly(ccnt,-1);
		var ccnt_indent=this.FindOuterIndentation(ccnt);
		if(ccnt_bracket>=0&&ccnt_indent>=0){
			if(this.GetIndentLevel(ccnt_indent)<=this.GetIndentLevel(ccnt_bracket)&&
			!(this.plugin_language_desc&&this.plugin_language_desc.indent_as_parenthesis)){
				//#endif and stuff in C, ignore it
				ccnt_indent=ccnt_bracket;
			}
		}
		var ret=Math.max(ccnt_bracket,ccnt_indent)
		if(ret>=ccnt){ret=-1;}
		var ccnt_query=Math.max(ccnt_bracket,ccnt_indent);
		if(!(ccnt_query>0)){ccnt_query=0;}
		if(ccnt_indent>ccnt_bracket){
			//the parser should be placing things here
			ccnt_query=this.ed.MoveToBoundary(this.SeekLC(this.GetLC(ccnt_indent)[0]+1,0),1,"space")
		}
		return {ccnt_editor:ret,ccnt_parser:ccnt_query}
	},
	///////////////////////////////
	IsLineEndAt:function(ccnt){
		var ch=this.ed.GetUtf8CharNeighborhood(ccnt)[1]
		if(ch==10){return 1}
		if(ch==13&&this.ed.GetUtf8CharNeighborhood(ccnt+1)[1]=='\n'){return 1}
		return 0
	},
	IsLeftBracket:function(s){
		var lang=this.plugin_language_desc
		var bs=lang.m_lbracket_tokens
		if(bs){
			for(var i=0;i<bs.length;i++){
				if(bs[i]==s){return 1;}
			}
		}
		return 0;
	},
	IsRightBracket:function(s){
		var lang=this.plugin_language_desc
		var bs=lang.m_rbracket_tokens
		for(var i=0;i<bs.length;i++){
			if(bs[i]==s){return 1;}
		}
		return 0;
	},
	IsRightBracketAt:function(ccnt){
		var lang=this.plugin_language_desc
		var bs=lang.m_rbracket_tokens
		if(!bs){return 0;}
		for(var i=0;i<bs.length;i++){
			if(bs[i]==this.ed.GetText(ccnt,Duktape.__byte_length(bs[i]))){return 1;}
		}
		return 0;
	},
	///////////////////////////////////////
	GetHorizontalSpan:function(){
		if(!this.ed){return 1;}
		if(this.m_enable_wrapping){
			return this.displayed_wrap_width+16;
		}
		var ed=this.ed;
		var x_max=ed.GetStateAt(ed.m_handler_registration["renderer"],ed.GetTextSize(),"ddddd")[4];
		return Math.max(Math.min(this.displayed_wrap_width,x_max),1)
	},
	///////////////////////////////////////
	NeedSave:function(){
		return (this.saved_point||0)!=this.ed.GetUndoQueueLength();
	},
	NeedXScrollAtWidth:function(w_content){
		if(this.ed&&UI.TestOption("show_x_scroll_bar")&&!this.disable_x_scroll){
			this.PrepareForRendering();
			var x_max=this.GetHorizontalSpan()+UI.GetCharacterAdvance(this.font,32);
			if(x_max>w_content-this.m_rendering_w_line_numbers){
				return 1;
			}
		}
		return 0;
	},
	///////////////////////////////////////
	//smarter clipboard actions
	//Cut:function(){
	//	var ccnt0=this.sel0.ccnt
	//	var ccnt1=this.sel1.ccnt
	//	if(ccnt0==ccnt1){
	//		var line_current=this.GetLC(ccnt1)[0]
	//		var line_ccnts=this.SeekAllLinesBetween(line_current,line_current+2)
	//		this.sel0.ccnt=line_ccnts[0];
	//		this.sel1.ccnt=line_ccnts[1];
	//	}
	//	W.Edit_prototype.Cut.call(this)
	//},
	///////////////////////////////////////
	GetRenderer:function(){
		return this.ed.GetHandlerByID(this.ed.m_handler_registration["renderer"]);
	},
	SeekAllLinesBetween:function(line0,line1_exclusive,is_valid_only){
		var ed=this.ed;
		var ret=[this.SeekLC(line0,0)]
		var ccnt=ret[0];
		var handler_id=ed.m_handler_registration["line_column"];
		for(var i=line0+1;i<line1_exclusive;i++){
			ccnt=ed.Bisect(handler_id,[i,0, i-1,ccnt],"llll")
			if(is_valid_only){
				var ccnt2=this.SnapToValidLocation(ccnt,1)
				if(ccnt2>ccnt&&this.SnapToValidLocation(ccnt,-1)<ccnt){
					//console.log(ret[0],ccnt,ccnt2,line0,line1_exclusive,ed.GetTextSize());
					var ln_real=this.GetLC(ccnt2)[0];
					if(ln_real>i){
						//some lines are hidden
						if(ln_real>line1_exclusive){
							ln_real=line1_exclusive
						}
						ccnt2=ed.Bisect(handler_id,[ln_real,0, i,ccnt],"llll")
						var i0=i;
						while(i<ln_real){
							ret.push(-1)
							i++;
						}
						ret.push(-1)
						if(ret.length>i0-line0){
							//we still need the first invalid line for indentation check
							ret[i0-line0]=-1-ccnt;
						}
						ccnt=ccnt2
						continue;
					}
				}
			}
			ret.push(ccnt)
		}
		return ret;
	},
	SnapToValidLocation:function(ccnt,side){
		var ccnt_ret=W.Edit_prototype.SnapToValidLocation.call(this,ccnt,side)
		var renderer=this.ed.GetHandlerByID(this.ed.m_handler_registration["renderer"]);
		return renderer.SnapToShown(this.ed,ccnt_ret,side);
	},
	DrawEllipsis:function(x,y,scale,color){
		x/=UI.pixels_per_unit;
		y/=UI.pixels_per_unit;
		scale/=UI.pixels_per_unit;
		if(!this.m_ellipsis_font){
			this.m_ellipsis_font=UI.Font(UI.icon_font_name,this.h_ellipsis)
			this.m_ellipsis_delta_x=(this.w_ellipsis-UI.GetCharacterAdvance(this.m_ellipsis_font,0x2026))*0.5
			this.m_ellipsis_delta_y=(UI.GetCharacterHeight(this.font)-this.h_ellipsis)*0.5;
			this.m_ellipsis_draw_w=this.w_ellipsis-this.padding_ellipsis*2
		}
		UI.RoundRect({
			x:x+this.padding_ellipsis*scale,
			y:y+this.m_ellipsis_delta_y*scale,
			w:this.m_ellipsis_draw_w*scale,h:this.h_ellipsis*scale,
			color:this.bgcolor_ellipsis,
			round:this.h_ellipsis*0.5,
			border_width:2,border_color:color})
		UI.DrawChar(this.m_ellipsis_font,
			x+this.m_ellipsis_delta_x*scale,
			y+this.m_ellipsis_delta_y*scale,color,
			0x2026)
	},
	//////////////////////////
	TestFunctionHint:function(){
		var fhctx=this.m_fhint_ctx;
		var ccnt_fcall_bracket=this.FindOuterBracket(this.sel1.ccnt,-1)
		if(!(fhctx&&fhctx.m_ccnt_fcall_bracket==ccnt_fcall_bracket)){
			//context changed, detect new fcall
			fhctx=undefined;
			if(ccnt_fcall_bracket>=0&&this.ed.GetUtf8CharNeighborhood(ccnt_fcall_bracket)[1]=='('.charCodeAt(0)){
				var ccnt_fcall_word1=this.ed.MoveToBoundary(ccnt_fcall_bracket+1,-1,"word_boundary_right")
				if(ccnt_fcall_word1>=0){
					var ccnt_fcall_word0=this.ed.MoveToBoundary(ccnt_fcall_word1,-1,"word_boundary_left")
					if(ccnt_fcall_word0>=0){
						var function_id=this.ed.GetText(ccnt_fcall_word0,ccnt_fcall_word1-ccnt_fcall_word0);
						var prototypes=UI.ED_QueryPrototypeByID(this,function_id)
						if(prototypes){
							fhctx={
								m_prototypes:prototypes,
								m_ccnt_fcall_bracket:ccnt_fcall_bracket,
								m_ccnt_fcall_word0:ccnt_fcall_word0,
								m_function_id:function_id,
							}
						}
					}
				}
			}
			this.m_fhint_ctx=fhctx
		}
		var s_fhint=undefined;
		if(fhctx&&this.sel1.ccnt-ccnt_fcall_bracket<MAX_PARSABLE_FCALL){
			var ccnt_rbracket=this.ed.MoveToBoundary(this.sel1.ccnt,1,"space_newline")
			//do the parsing in native code, GetStateAt then ComputeCharColorID, then do the deed
			var is_tail=1;
			if(this.ed.GetUtf8CharNeighborhood(ccnt_rbracket)[1]!=')'.charCodeAt(0)){
				var ccnt_rbracket_r=this.FindOuterBracket(ccnt_rbracket,1);
				if(ccnt_rbracket<ccnt_rbracket_r){
					ccnt_rbracket=ccnt_rbracket_r;
					ccnt_rbracket=ccnt_rbracket-this.BracketSizeAt(ccnt_rbracket,1);
				}
				is_tail=0;
			}
			fhctx.m_ccnt_rbracket=ccnt_rbracket;
			var n_commas=UI.ED_CountCommas(this.ed,ccnt_fcall_bracket,this.sel1.ccnt);
			var n_commas_before=UI.ED_CountCommas(this.ed,ccnt_fcall_bracket,this.sel1.ccnt-1);
			var n_total_commas=n_commas;
			if(!is_tail){
				n_total_commas=UI.ED_CountCommas(this.ed,ccnt_fcall_bracket,ccnt_rbracket);
			}
			if(n_commas!=undefined){
				//notification
				//var proto_acceptable=undefined;
				var prototypes=fhctx.m_prototypes;
				var a_proto=[];
				var proto_arv={};
				for(var i=0;i<prototypes.length;i++){
					var proto_i=prototypes[i].proto;
					if(n_total_commas>=proto_i.length){continue;}
					var proto_acceptable=proto_i;
					var a_proto_i=[];
					a_proto_i.push(fhctx.m_function_id,UI.ED_RichTextCommandChar(UI.RICHTEXT_COMMAND_SET_STYLE+11),'(');
					for(var j=0;j<proto_acceptable.length;j++){
						if(j>0){a_proto_i.push(UI.ED_RichTextCommandChar(UI.RICHTEXT_COMMAND_SET_STYLE+11),', ');}
						if(j==n_commas_before){
							a_proto_i.push(
								UI.ED_RichTextCommandChar(UI.RICHTEXT_COMMAND_SET_STYLE+6),
								proto_acceptable[j]);
						}else{
							a_proto_i.push(
								UI.ED_RichTextCommandChar(UI.RICHTEXT_COMMAND_SET_STYLE+0),
								proto_acceptable[j])
						}
					}
					a_proto_i.push(
						UI.ED_RichTextCommandChar(UI.RICHTEXT_COMMAND_SET_STYLE+11),
						')');
					var s_proto_i=a_proto_i.join('');
					if(proto_arv[s_proto_i]){continue;}
					proto_arv[s_proto_i]=1;
					//documentation part
					if(a_proto.length){
						a_proto.push('\n');
					}
					a_proto.push(s_proto_i);
					if(prototypes[i].m_brief){
						a_proto.push(
							'\n',
							UI.ED_RichTextCommandChar(UI.RICHTEXT_COMMAND_SET_STYLE+12),
							'   ',UI.ED_RichTextCommandChar(UI.RICHTEXT_COMMAND_INDENT_HERE),prototypes[i].m_brief);
					}
					if(prototypes[i].m_param_docs){
						var is_first=1;
						for(var j=0;j<proto_acceptable.length;j++){
							var s_param_doc=prototypes[i].m_param_docs[j];
							if(s_param_doc){
								if(is_first){
									a_proto.push(
										'\n',
										UI.ED_RichTextCommandChar(UI.RICHTEXT_COMMAND_SET_STYLE+13),
										'   ',UI.ED_RichTextCommandChar(UI.RICHTEXT_COMMAND_INDENT_HERE),UI._('Parameters'))
									is_first=0;
								}
								a_proto.push(
									'\n',
									UI.ED_RichTextCommandChar(UI.RICHTEXT_COMMAND_SET_STYLE+(j==n_commas_before?14:13)),
									'        ',proto_acceptable[j],
									UI.ED_RichTextCommandChar(UI.RICHTEXT_COMMAND_SET_STYLE+12),
									'  ',UI.ED_RichTextCommandChar(UI.RICHTEXT_COMMAND_INDENT_HERE),
									s_param_doc);
							}
						}
					}
					if(prototypes[i].m_return){
						a_proto.push(
							'\n',
							UI.ED_RichTextCommandChar(UI.RICHTEXT_COMMAND_SET_STYLE+13),
							'   ',UI.ED_RichTextCommandChar(UI.RICHTEXT_COMMAND_INDENT_HERE),UI._('Returns'),
							UI.ED_RichTextCommandChar(UI.RICHTEXT_COMMAND_SET_STYLE+12),
							'  ',
							prototypes[i].m_return);
					}
					//a_proto.push(UI.ED_RichTextCommandChar(UI.RICHTEXT_COMMAND_SET_STYLE+12),'\n');
					//n_commas_before
				}
				////////
				if(a_proto.length){
					fhctx.s_notification=a_proto.join('');
				}else{
					fhctx.s_notification=undefined;
				}
				////////
				if(is_tail){
					for(var i=0;i<prototypes.length;i++){
						var proto_i=prototypes[i]
						if(n_commas>=proto_i.length){continue;}
						var ccnt_lcomma=this.ed.MoveToBoundary(this.sel1.ccnt,-1,"space_newline")
						var ch_prev=String.fromCharCode(this.ed.GetUtf8CharNeighborhood(ccnt_lcomma)[0]);
						var was_comma=(ch_prev==','||ch_prev=='(');
						var array_fhint=[]
						for(var j=n_commas;j<proto_i.length;j++){
							if(array_fhint.length>0||was_comma){
								array_fhint.push(proto_i[j])
							}
							array_fhint.push(',')
						}
						if(array_fhint.length>0){
							array_fhint.pop();
						}
						//array_fhint.push(')');
						s_fhint=array_fhint.join('');
						break
					}
				}
			}
		}
		if(fhctx){
			fhctx.s_fhint=s_fhint;
		}
	},
	//////////////////////////
	CancelAutoCompletion:function(){
		this.m_ac_context=undefined;
		this.m_explicit_accands=undefined;
	},
	/*
	needed for accands
		length:,
		at:function(id){},
		s_prefix:,
		ccnt0:,
	*/
	TestAutoCompletion:function(is_explicit){
		if(this.sel0.ccnt!=this.sel1.ccnt){
			this.m_ac_activated=0;
			return 0;
		}
		//call plugin-defined AC hooks
		var is_user_defined=0;
		var accands=undefined;
		if(is_explicit&&!accands){
			var hk=this.m_event_hooks["explicitAutoComplete"];
			if(hk){
				for(var i=hk.length-1;i>=0;i--){
					accands=hk[i].call(this);
					if(accands){
						is_user_defined=1;
						break;
					}
				}
			}
		}
		var extras=[];
		if(this.m_explicit_accands){
			extras.push(this.m_explicit_accands);
		}
		var hk=this.m_event_hooks["autoComplete"];
		if(hk){
			for(var i=hk.length-1;i>=0;i--){
				var more_extras=hk[i].call(this);
				if(more_extras){
					extras.push(more_extras);
				}
			}
		}
		if(!accands){
			var real_extras=Array.prototype.concat.apply([],extras);
			if(this.plugin_language_desc.parser=="C"&&!this.IsBracketEnabledAt(this.sel1.ccnt)){
				this.m_ac_activated=0;
				return 0;
			}
			var neib=this.ed.GetUtf8CharNeighborhood(this.sel1.ccnt);
			//\u002e: dot
			if(!real_extras.length){
				if(!((UI.ED_isWordChar(neib[0])||this.plugin_language_desc.parser=="C"&&neib[0]==0x2e)&&!UI.ED_isWordChar(neib[1]))){
					this.m_ac_activated=0;
					return 0;
				}
			}
			accands=UI.ED_QueryAutoCompletion(this,this.sel1.ccnt, real_extras);
		}
		if(!accands){
			this.m_explicit_accands=undefined;
			this.m_ac_activated=0;
			return 0;
		}
		this.m_ac_context=NewACContext({
			m_is_spell_mode:0,
			m_ccnt:this.sel1.ccnt,
			m_is_user_defined:is_user_defined,
			m_accands:accands,
			m_owner:this,
		})
		return 1
	},
	StartACWithCandidates:function(cands){
		this.m_explicit_accands=cands;
		this.TestAutoCompletion("explicit");
		var acctx=this.m_ac_context;
		if(acctx&&acctx.m_accands.m_common_prefix){
			this.ActivateAC();
			this.ConfirmAC(undefined);
		}else{
			this.ActivateAC();
		}
		//this.ActivateAC()
		UI.Refresh()
	},
	TestCorrection:function(){
		if(this.sel0.ccnt!=this.sel1.ccnt){return 0;}
		if(!this.plugin_language_desc.default_hyphenator_name){return 0;}
		var renderer=this.ed.GetHandlerByID(this.ed.m_handler_registration["renderer"]);
		var spell_ctx=renderer.HunspellSuggest(this.ed,this.sel1.ccnt)
		if(!spell_ctx){return 0;}
		var suggestions=spell_ctx.suggestions
		suggestions.push("Add '@1' to dictionary".replace("@1",spell_ctx.s_prefix))
		var accands={
			length:suggestions.length,
			at:function(id){return this.suggestions[id]},
			suggestions:suggestions.map(function(a){return {name:a,weight:1}}),
			s_prefix:spell_ctx.s_prefix,
			ccnt0:spell_ctx.ccnt0,
		}
		this.m_ac_context=NewACContext({
			m_is_spell_mode:1,
			m_ccnt:this.sel1.ccnt,
			m_accands:accands,
			m_owner:this,
		})
		return 1;
	},
	ActivateAC:function(){
		if(!this.m_ac_context){return;}
		this.m_ac_activated=1;
		UI.SetFocus(this);
		UI.Refresh()
	},
	ConfirmAC:function(id){
		var acctx=this.m_ac_context;
		if(!acctx||!acctx.m_accands){return;}
		var s_prefix=acctx.m_accands.s_prefix
		if(acctx.m_is_spell_mode&&id==acctx.m_n_cands-1){
			//coulddo: remove, or just give a "user-dic-editing" option
			var renderer=this.ed.GetHandlerByID(this.ed.m_handler_registration["renderer"]);
			renderer.HunspellAddWord(s_prefix);
			this.CancelAutoCompletion()
			this.m_ac_activated=0;
			UI.Refresh();
			return;
		}
		var lg=Duktape.__byte_length(s_prefix);
		if(id==undefined){lg=0;}
		var ccnt0=this.sel1.ccnt-lg
		if(acctx.m_is_spell_mode||acctx.m_accands.ccnt0!=undefined){
			ccnt0=acctx.m_accands.ccnt0
			if(!acctx.m_is_spell_mode){
				lg=this.sel1.ccnt-ccnt0;
			}
		}
		var sname=(id==undefined?acctx.m_accands.m_common_prefix:acctx.m_accands.at(id).name)
		if(acctx.m_is_spell_mode){
			sname=UI.ED_CopyCase(sname,sname.toLowerCase(),sname.toUpperCase(),s_prefix)
		}
		var lg2=Duktape.__byte_length(sname);
		this.HookedEdit([ccnt0,lg,sname])
		if(!acctx.m_accands.m_common_prefix){
			this.m_ac_activated=0;
		}
		this.sel0.ccnt=ccnt0+lg2
		this.sel1.ccnt=ccnt0+lg2
		this.CallOnChange()
		if(acctx.m_accands.m_common_prefix){
			this.m_ac_activated=1;
		}
		if(acctx.m_accands.length<2){
			this.m_ac_activated=0;
		}
		//we need to keep the explicit AC cands
		//this.CancelAutoCompletion()
		this.m_ac_context=undefined;
		this.UserTypedChar()
		UI.SetFocus(this);
		UI.Refresh()
	},
	//////////////////////////
	PrepareForRendering:function(){
		if(this.m_rendered_frame_id!=UI.m_frame_tick){
			this.m_rendered_frame_id=UI.m_frame_tick;
		}else{
			return;
		}
		//prepare the line numbers
		var edstyle=UI.default_styles.code_editor;
		var w_line_numbers=0;
		var show_line_numbers=(UI.TestOption("show_line_numbers")&&!this.disable_line_numbers)
		if(show_line_numbers){
			var lmax=(this.ed?this.GetLC(this.ed.GetTextSize())[0]:0)+1
			w_line_numbers=Math.max(lmax.toString().length,3)*UI.GetCharacterAdvance(edstyle.line_number_font,56);
		}
		var w_bookmark=UI.GetCharacterAdvance(edstyle.bookmark_font,56)+4;
		w_line_numbers+=edstyle.padding+w_bookmark;
		this.m_rendering_w_line_numbers=w_line_numbers;
		//prepare bookmarks - they appear under line numbers
		var bm_xys=undefined;
		var bm_ccnts=[]
		if(this.m_bookmarks){
			for(var i=0;i<this.m_bookmarks.length;i++){
				var bm=this.m_bookmarks[i];
				if(bm){
					bm_ccnts.push([i,bm.ccnt])
				}
			}
		}
		var bm_filtered=[];
		if(this.m_unkeyed_bookmarks){
			for(var i=0;i<this.m_unkeyed_bookmarks.length;i++){
				var bm=this.m_unkeyed_bookmarks[i];
				if(bm){
					bm_ccnts.push([-1,bm.ccnt])
					bm_filtered.push(bm)
				}
			}
		}
		this.m_unkeyed_bookmarks=bm_filtered;
		if(bm_ccnts.length){
			bm_ccnts.sort(function(a,b){return (a[1]*10+a[0])-(b[1]*10+b[0]);});
			bm_xys=this.ed.GetXYEnMasse(bm_ccnts.map(function(a){return a[1]}))
		}
		this.m_rendering_bm_ccnts=bm_ccnts;
		this.m_rendering_bm_xys=bm_xys;
		var line_current=this.ed?this.GetLC(this.sel1.ccnt)[0]:0;
		this.m_rendering_line_current=line_current;
	},
	GetSmartFoldRange:function(ccnt){
		var line=this.GetLC(ccnt)[0]
		var ccnt_l0=this.SeekLC(line,0)
		var ccnt_l1=this.SeekLC(line+1,0)
		var ccnt_outer0=this.FindOuterBracket_SizeFriendly(ccnt_l1,-1)
		var range=undefined
		if(ccnt_outer0>=ccnt_l0){
			//found bracket on the line
			var ccnt_outer1=this.FindOuterBracket_SizeFriendly(ccnt_l1,1)
			if(ccnt_outer1>ccnt_outer0){
				range=[ccnt_outer0+this.BracketSizeAt(ccnt_outer0,0),ccnt_outer1-this.BracketSizeAt(ccnt_outer1,1)]
			}
		}else{
			var id_indent=this.ed.m_handler_registration["seeker_indentation"]
			var my_level=this.GetIndentLevel(this.ed.MoveToBoundary(ccnt,1,"space"));
			var ccnt_new=this.ed.FindNearest(id_indent,[Math.min(my_level,MAX_ALLOWED_INDENTATION)],"l",ccnt_l1,1);
			if(ccnt_new>ccnt_l1){
				ccnt_new=this.SeekLC(this.GetLC(ccnt_new)[0],0)-1
				if(ccnt_new>ccnt_l1){
					if(this.IsRightBracketAt(ccnt_new+1)){
						ccnt_new++
					}
					range=[this.SnapToValidLocation(Math.max(ccnt_l1-1,0),-1),ccnt_new]
				}
			}
		}
		return range
	},
	SmartReplace:function(ccnt0,ccnt1,s_regexp,fcallback){
		var rctx={
			m_ccnt0:ccnt0,
			m_ccnt1:ccnt1,
			m_frontier:ccnt0,
			m_match_cost:64,
			m_s_replace:"",
			m_s_replace_callback:fcallback,
			m_owner:this,
		}
		if(this.owner){
			this.owner.AcquireEditLock();
		}
		var ffind_next=(function(){
			//print("replace: ffind_next ",rctx.m_frontier)
			rctx.m_frontier=UI.ED_Search(this.ed,rctx.m_frontier,1,s_regexp,UI.SEARCH_FLAG_CASE_SENSITIVE|UI.SEARCH_FLAG_HIDDEN|UI.SEARCH_FLAG_REGEXP,
				1048576,undefined,rctx)
			//print("search finished ",s_replace)
			var ccnt_frontier=UI.GetSearchFrontierCcnt(rctx.m_frontier)
			if(!(ccnt_frontier>0)){
				var need_onchange=0
				if(this.owner){
					this.owner.DismissNotification('replace_progress')
					this.owner.ReleaseEditLock();
				}
				if(rctx.m_current_replace_job){
					this.sel1.side=1;
					var n_replaced=UI.ED_ApplyReplaceOps(this.ed,rctx.m_current_replace_job)
					this.sel1.side=-1;
					if(n_replaced){
						this.CallOnChange();
					}
				}
				UI.Refresh()
			}else{
				if(this.owner){
					var progress=(ccnt_frontier-rctx.m_ccnt0)/(rctx.m_ccnt1-rctx.m_ccnt0);
					this.owner.CreateNotification({id:'replace_progress',icon:undefined,
						text:"Replacing @1%...".replace('@1',(progress*100).toFixed(0)),
						progress:progress
					},"quiet")
				}
				UI.NextTick(ffind_next);
			}
		}).bind(this);
		ffind_next();
	},
	RenderWithLineNumbers:function(scroll_x,scroll_y, area_x,area_y,area_w,area_h,enable_interaction,drop_bg){
		this.PrepareForRendering();
		var w_line_numbers=this.m_rendering_w_line_numbers;
		var bm_ccnts=this.m_rendering_bm_ccnts;
		var bm_xys=this.m_rendering_bm_xys;
		var line_current=this.m_rendering_line_current
		//bg
		var edstyle=UI.default_styles.code_editor;
		UI.RoundRect({color:edstyle.line_number_bgcolor,x:area_x,y:area_y,w:Math.min(w_line_numbers,area_w),h:area_h})
		if(!drop_bg){
			UI.RoundRect({color:this.read_only?edstyle.line_number_bgcolor:edstyle.bgcolor,x:area_x+w_line_numbers,y:area_y,w:area_w-w_line_numbers,h:area_h})
		}
		//main editor
		if(enable_interaction){
			var renderer=undefined;
			if(this.ed){
				renderer=this.GetRenderer();
				renderer.m_enable_ceo_rendering=1;
			}
			this.RenderAsWidget(enable_interaction,
				area_x+w_line_numbers+edstyle.padding,area_y,
				area_w-w_line_numbers-edstyle.padding,
				area_h);
			if(renderer){
				renderer.m_enable_ceo_rendering=0;
			}
			scroll_x=this.visible_scroll_x;
			scroll_y=this.visible_scroll_y;
		}else{
			this.ed.Render({x:scroll_x,y:scroll_y,w:area_w-w_line_numbers-edstyle.padding,h:area_h,
				scr_x:(area_x+w_line_numbers+edstyle.padding)*UI.pixels_per_unit,scr_y:area_y*UI.pixels_per_unit,
				scale:UI.pixels_per_unit, obj:this});
		}
		//line # / bookmarks
		var hc=UI.GetCharacterHeight(this.font)
		if(bm_xys){
			UI.PushCliprect(area_x,area_y,area_w,area_h)
			for(var i=0;i<bm_ccnts.length;i++){
				var y=bm_xys[i*2+1]-scroll_y+area_y
				var id=bm_ccnts[i][0]
				UI.RoundRect({x:area_x+2,y:y+4,w:w_line_numbers-4,h:hc-8,
					color:edstyle.bookmark_color,
					border_color:edstyle.bookmark_border_color,
					border_width:Math.min(hc/8,2),
					round:4})
				if(id>=0){
					UI.DrawChar(edstyle.bookmark_font,area_x+4,y+4,edstyle.bookmark_text_color,48+id)
				}
			}
			UI.PopCliprect()
		}
		var rendering_ccnt0=this.SeekXY(scroll_x,scroll_y)
		var rendering_ccnt1=this.SeekXY(scroll_x+area_w,scroll_y+area_h)
		var dy_line_number=(UI.GetCharacterHeight(this.font)-UI.GetCharacterHeight(edstyle.line_number_font))*0.5;
		var line0=this.GetLC(rendering_ccnt0)[0];
		var line1=this.GetLC(rendering_ccnt1)[0];
		var line_ccnts=this.SeekAllLinesBetween(line0,line1+1,"valid_only");
		var line_xys=this.ed.GetXYEnMasse(line_ccnts)
		var diff=this.m_diff_from_save
		var line_indents=undefined;
		if(!this.hyphenator&&enable_interaction){
			line_indents=[];
			for(var i=0;i<line_ccnts.length;i++){
				var ind=undefined;
				var ccnt=line_ccnts[i];
				if(ccnt<-1){ccnt=-1-ccnt;}
				if(ccnt>=0){
					ind=this.ed.MoveToBoundary(ccnt,1,"space")-ccnt;
				}
				line_indents[i]=ind;
			}
		}
		var fold_btn_ccnts=(line_indents?[]:undefined);
		var fold_btn_next_line_ccnts=(line_indents?[]:undefined);
		var show_line_numbers=(UI.TestOption("show_line_numbers")&&!this.disable_line_numbers)
		UI.PushCliprect(area_x,area_y,area_w,area_h)
		for(var i=0;i<line_ccnts.length;i++){
			if(line_ccnts[i]<0){continue;}
			if(i&&line_ccnts[i]==line_ccnts[i-1]){break;}
			var s_line_number=(line0+i+1).toString();
			var y=line_xys[i*2+1]-scroll_y+dy_line_number+area_y
			var text_dim=(show_line_numbers?UI.MeasureText(edstyle.line_number_font,s_line_number):{w:0,h:0})
			var x=w_line_numbers-text_dim.w-edstyle.padding
			if(diff){
				var ccnt_line_next=-1;
				for(var j=i+1;j<line_ccnts.length;j++){
					if(line_ccnts[j]>=0){
						ccnt_line_next=line_ccnts[j]
						break
					}
				}
				if(ccnt_line_next<0){
					ccnt_line_next=this.SeekLC(line1+1,0)
				}
				if(diff.RangeQuery(line_ccnts[i],ccnt_line_next)){
					//line modified
					//s_line_number=s_line_number+"*";
					UI.RoundRect({
						x:area_x+w_line_numbers-6,y:line_xys[i*2+1]-scroll_y+area_y,
						w:6,h:Math.min(Math.max((line_xys[i*2+3]-line_xys[i*2+1])||hc,hc),area_h),
						color:edstyle.sbar_diff_color})
					//UI.RoundRect({
					//	x:area_x,y:line_xys[i*2+1]-scroll_y+area_y,
					//	w:w_line_numbers,h:Math.min(Math.max((line_xys[i*2+3]-line_xys[i*2+1])||hc,hc),area_h),
					//	color:edstyle.sbar_diff_color&0x55ffffff})
				}
			}
			if(enable_interaction){
				W.Region("$bookmark_l"+(line0+i),{
					x:area_x,y:y,
					w:w_line_numbers,h:Math.min(Math.max((line_xys[i*2+3]-line_xys[i*2+1])||hc,hc),area_h),
					mouse_cursor:"arrow",
					OnClick:function(line_id){
						if(this.ToggleBookmarkOnLine){
							this.ToggleBookmarkOnLine(line_id)
						}
					}.bind(this,line0+i)
				})
			}
			if(show_line_numbers){
				W.Text("",{x:area_x+x,y:y, font:edstyle.line_number_font,text:s_line_number,color:line0+i==line_current?edstyle.line_number_color_focus:edstyle.line_number_color})
			}
			//folding button
			if(line_indents&&(line_ccnts[i+1]>0||line_ccnts[i+1]<-1)){
				//indentat... just count spaces
				var ccnt_line_next=line_ccnts[i+1];
				if(ccnt_line_next<0){ccnt_line_next=-1-ccnt_line_next;}
				if(line_indents[i+1]>line_indents[i]){
					fold_btn_ccnts.push(line_ccnts[i]+line_indents[i])
					fold_btn_next_line_ccnts.push(ccnt_line_next);
				}
			}
		}
		if(fold_btn_ccnts){
			var fold_btn_xys=this.ed.GetXYEnMasse(fold_btn_ccnts);
			var renderer=this.GetRenderer()
			for(var i=0;i<fold_btn_ccnts.length;i++){
				//really draw the folding buttons
				var x=fold_btn_xys[i*2+0]-scroll_x;
				var y=fold_btn_xys[i*2+1]-scroll_y;
				var is_hidden=renderer.IsRangeHidden(this.ed,fold_btn_next_line_ccnts[i]-1,fold_btn_next_line_ccnts[i]);
				W.Button("fold_"+fold_btn_ccnts[i],{
					x:area_x+w_line_numbers+edstyle.padding+Math.max(x,0)-edstyle.fold_button_size-2,
					y:area_y+y+(hc-edstyle.fold_button_size)*0.5,
					w:edstyle.fold_button_size,
					h:edstyle.fold_button_size,
					style:edstyle.fold_button_style,
					text:is_hidden?'+':'-',
					OnClick:function(ccnt,is_hidden){
						var sel=this.GetSmartFoldRange(ccnt);
						if(sel){
							var renderer=this.GetRenderer()
							if(is_hidden){
								renderer.ShowRange(this.ed,sel[0],sel[1]);
							}else{
								renderer.HideRange(this.ed,sel[0],sel[1]);
								this.SetSelection(
									renderer.SnapToShown(this.ed,this.sel0.ccnt,this.sel0.ccnt>=sel[1]?1:-1),
									renderer.SnapToShown(this.ed,this.sel1.ccnt,this.sel1.ccnt>=sel[1]?1:-1))
							}
							this.CallOnSelectionChange();
							UI.Refresh()
						}
					}.bind(this,fold_btn_ccnts[i],is_hidden)
				})
			}
		}
		UI.PopCliprect()
		//line number bar shadow when x scrolled
		var x_shadow_size_max=edstyle.x_scroll_shadow_size
		var x_shadow_size=Math.min(scroll_x/8,x_shadow_size_max)
		if(x_shadow_size>0){
			UI.PushCliprect(area_x+w_line_numbers,area_y,area_w-w_line_numbers,area_h)
			UI.RoundRect({
				x:area_x+w_line_numbers-x_shadow_size_max*2+x_shadow_size,
				y:area_y-x_shadow_size_max,
				w:2*x_shadow_size_max, 
				h:area_h+x_shadow_size_max*2,
				round:x_shadow_size_max,
				border_width:-x_shadow_size_max,
				color:edstyle.x_scroll_shadow_color})
			UI.PopCliprect()
		}
	},
	//////////////////////////
	SmartPaste:function(){
		var sel=this.GetSelection();
		var ed=this.ed;
		//vsel-and-paste case
		if(this.m_autoedit_context&&this.m_autoedit_mode=='explicit'){
			var renderer=this.GetRenderer();
			var locs=this.m_autoedit_locators
			if(locs&&!renderer.m_tentative_ops){
				var line_id=-1;
				//the line(s) intersected by ops... multi-line edit should cancel it
				for(var i=0;i<locs.length;i+=2){
					if(locs[i+1].ccnt>=sel[1]){
						if(locs[i+0].ccnt<=sel[0]){
							line_id=i
							break
						}
					}
				}
				if(line_id>=0){
					var sinsert=UI.ED_GetClipboardTextSmart(s_target_indent);
					if(sinsert==undefined){
						sinsert=UI.SDL_GetClipboardText();
					}
					var lines=sinsert.replace(/\r/g,'').split('\n');
					var shack=UI.ED_RichTextCommandChar(0x108000);
					///////
					var s_example=[
						ed.GetText(locs[line_id].ccnt,sel[0]-locs[line_id].ccnt),
						shack,
						ed.GetText(sel[1],locs[line_id+1].ccnt-sel[1]),
					].join('');
					if(UI.ED_AutoEdit_SetExample(this.m_autoedit_context,line_id>>1,s_example)){
						//include examples in the evaluation
						var ops=UI.ED_AutoEdit_Evaluate(this.m_autoedit_context,locs,1);
						if(this.InvalidateAutoEdit){
							this.InvalidateAutoEdit();
						}
						var p_lines=0;
						for(var i=0;i<ops.length;i+=3){
							if(ops[i+2]){
								ops[i+2]=ops[i+2].replace(shack,lines[p_lines++]||"");
							}
						}
						this.HookedEdit(ops);
						this.CallOnChange();
						UI.Refresh()
						return;
					}
				}
			}
		}
		/*
		indent handling
		line head: nothing/less (tell from the last line), good
			if it's nothing / less, compensate to the correct ind first: move last line to first
		match minimal indent with current line
			ignore paste location as long as it's inside the indent
		*/
		var ccnt_corrected=ed.MoveToBoundary(this.SeekLC(this.GetLC(sel[1])[0],0),1,"space");
		if(sel[1]>sel[0]&&ed.MoveToBoundary(sel[0],-1,"space")<sel[0]){
			//line overwrite mode, use sel[0]
			ccnt_corrected=sel[0];
		}else if(ed.GetUtf8CharNeighborhood(ccnt_corrected)[1]==10){
			var ccnt_lh=this.SeekLC(this.GetLC(ccnt_corrected)[0],0)
			if(ed.MoveToBoundary(ccnt_lh,1,"space")==ccnt_corrected){
				//empty line: simply paste before this line, do nothing
			}else{
				//paste to the next line if called at eoln
				ccnt_corrected++;
				ccnt_corrected=ed.MoveToBoundary(ccnt_corrected,1,"space")
			}
		}else if(sel[0]==sel[1]&&sel[1]<ccnt_corrected){
			//we're inside the indent
			//do nothing - use the indent
		}else if(sel[0]==sel[1]&&sel[0]>ccnt_corrected){
			//we're *after* the indent
			//do nothing - use the indent
		}else{
			ccnt_corrected=sel[0];
		}
		var ccnt_lh=this.SeekLC(this.GetLC(ccnt_corrected)[0],0)
		var s_target_indent=ed.GetText(ccnt_lh,ccnt_corrected-ccnt_lh)
		if(s_target_indent==undefined){
			this.Paste()
			return;
		}
		var sinsert=UI.ED_GetClipboardTextSmart(s_target_indent)
		if(sinsert==undefined){
			this.Paste()
			return;
		}
		var ccnt_new=ccnt_lh;
		if(ccnt_corrected<=sel[0]){
			this.HookedEdit([ccnt_corrected,0,sinsert,sel[0],sel[1]-sel[0],undefined])
		}else{
			this.HookedEdit([sel[0],sel[1]-sel[0],undefined,ccnt_corrected,0,sinsert])
			ccnt_new-=(sel[1]-sel[0])
		}
		this.CallOnChange()
		ccnt_new=ed.MoveToBoundary(ccnt_new+Duktape.__byte_length(sinsert),1,"space")
		this.SetCaretTo(ccnt_new)
		UI.Refresh()
	},
	//////////////////////////
	HookedEdit:function(ops){
		var obj=this.owner
		if(obj){
			if(obj.read_only){return;}
			if(this.saved_point>this.ed.GetUndoQueueLength()){
				//undo beyond the saved point, then edit sth else, the save point is lost permanently
				this.saved_point=-1;
			}
			var hk=this.m_event_hooks["beforeEdit"];
			if(hk){
				for(var i=hk.length-1;i>=0;i--){
					hk[i].call(this,ops)
				}
			}
		}
		this.ed.Edit(ops);
	},
	OnMouseDown:function(event){
		if(this.m_is_preview||!this.ed){return;}
		W.Edit_prototype.OnMouseDown.call(this,event)
	},
	//OnMouseMove:function(event){
	//	this.m_last_mousemove=event;
	//	W.Edit_prototype.OnMouseMove.call(this,event)
	//	if(UI.TestOption("show_minimap")&&UI.TestOption("auto_hide_minimap")){
	//		UI.Refresh()
	//	}
	//},
	OnClick:function(event){
		if(event.button==UI.SDL_BUTTON_RIGHT){
			this.OnRightClick(event);
		}
	},
	OnRightClick:function(event){
		if(!this.m_is_main_editor){return;}
		//generate the menu right here, using current-frame menu entries
		var menu_context=UI.CreateContextMenu("context_menu_group");
		if(!menu_context){return;}
		this.m_menu_context={x:event.x,y:event.y,menu:menu_context,is_first:1};
		menu_context=undefined;
		UI.Refresh()
	},
	toJSON:function(){
		return this.ed.GetText();
	},
})

W.MinimapThingy_prototype={
	dimension:'y',
	value_min:0,
	value_max:1,
	OnMouseDown:function(event){
		this.anchored_value=this.value
		this.anchored_xy=event[this.dimension]
		UI.CaptureMouse(this)
	},
	OnMouseUp:function(event){
		if(this.anchored_value==undefined){return;}
		this.OnMouseMove(event);
		UI.ReleaseMouse(this)
		this.anchored_value=undefined
		if(this.OnApply){this.OnApply(this.value);}
		UI.Refresh()
	},
	OnMouseMove:function(event){
		if(this.anchored_value==undefined){return;}
		this.OnChange(Math.min(Math.max(this.anchored_value+(event[this.dimension]-this.anchored_xy)/this.factor,this.value_min),this.value_max))
	},
}

UI.IsSearchFrontierCompleted=function(frontier){
	return UI.GetSearchFrontierCcnt(frontier)<0
}

UI.GetSearchFrontierCcnt=function(frontier){
	if((typeof frontier)=='number'){
		return frontier
	}else{
		return frontier.ccnt
	}
}

var g_re_regexp_escape=new RegExp("[\\-\\[\\]\\/\\{\\}\\(\\)\\*\\+\\?\\.\\\\\\^\\$\\|\"]","g")
var RegexpEscape=function(s){
	return s.replace(g_re_regexp_escape,"\\$&");
}

var fadein=function(C,alpha){
	return (((((C>>24)&0xff)*alpha)|0)<<24)|(C&0xffffff)
};

UI.non_animated_values.x_shake=1
UI.non_animated_values.dx_shake=1
UI.non_animated_values.ddx_shake=1
W.NotificationItem=function(id,attrs){
	if(!UI.context_parent[id]){
		attrs.alpha=0;
		attrs.dx_shake=UI.default_styles.code_editor.dx_shake_notification
	}
	var obj=UI.Keep(id,attrs)
	UI.StdStyling(id,obj,attrs, "code_editor_notification");
	//shaking
	if(!obj.x_shake){obj.x_shake=0}
	if(obj.x_shake||obj.dx_shake){
		var dt_all=Math.min(Duktape.__ui_seconds_between_ticks(UI.m_last_frame_tick,UI.m_frame_tick),1/30)
		if(!obj.dx_shake){obj.dx_shake=0}
		if(!obj.ddx_shake){obj.ddx_shake=0}
		for(var dt_i=0;dt_i<dt_all;dt_i+=0.001){
			//http://en.wikipedia.org/wiki/Newmark-beta_method
			var dt=Math.min(dt_all-dt_i,0.001)
			var a0=obj.ddx_shake
			var a1=-(obj.k_shake*obj.x_shake)-(obj.damping_shake*obj.dx_shake);
			var v0=obj.dx_shake
			var v1=v0+dt*0.5*(a0+a1)
			var x0=obj.x_shake
			var x1=x0+dt*(v0+dt*0.25*(a0+a1))
			obj.x_shake=x1
			obj.dx_shake=v1
			obj.ddx_shake=a1
		}
		if(Math.abs(obj.dx_shake)<obj.dx_min_shake&&Math.abs(obj.x_shake)<obj.x_min_shake){
			obj.x_shake=0
			obj.dx_shake=0;
			obj.ddx_shake=0;
		}
		UI.AutoRefresh()
	}
	///////////
	if(!obj.m_cached_prt||obj.text!=obj.m_cached_text){
		obj.m_cached_prt=UI.ED_FormatRichText(
			Language.GetHyphenator(UI.m_ui_language),
			obj.text,4,obj.w_text,obj.styles);
		obj.m_cached_text=obj.text;
	}
	//var tmp={w:obj.w_text,h:1e17,font:obj.font,text:obj.text}
	//UI.LayoutText(tmp);
	obj.w=obj.padding*2+obj.w_icon+obj.w_text
	obj.h=obj.padding*2+Math.max(obj.w_icon,obj.m_cached_prt.m_h_text)
	UI.StdAnchoring(id,obj);
	obj.alpha=1;//disable fadein to avoid weird effects, it's not that needed anyway
	UI.RoundRect({x:obj.x+obj.x_shake+obj.border_width-obj.shadow_size*0.375,y:obj.y-obj.shadow_size*0.375,
		w:obj.w+obj.shadow_size*1.125,h:obj.h+obj.shadow_size*1.125,
		color:fadein(obj.shadow_color,obj.alpha),
		round:obj.shadow_size,
		border_width:-obj.shadow_size})
	UI.RoundRect({x:obj.x+obj.x_shake+obj.border_width,y:obj.y,w:obj.w,h:obj.h,
		color:fadein(obj.color,obj.alpha),round:obj.round,border_color:fadein(obj.border_color,obj.alpha),border_width:obj.border_width})
	if(obj.progress!=undefined){
		//progress
		UI.PushCliprect(obj.x+obj.x_shake+obj.border_width,obj.y,obj.w*obj.progress,obj.h)
		UI.RoundRect({x:obj.x+obj.x_shake+obj.border_width,y:obj.y,w:obj.w,h:obj.h,
			color:fadein(obj.progress_color,obj.alpha),
			round:obj.round,
			border_color:fadein(obj.border_color,obj.alpha),border_width:obj.border_width})
		UI.PopCliprect()
	}
	//if(obj.icon){UI.DrawChar(obj.icon_font,obj.x+obj.x_shake+obj.padding,obj.y+obj.padding,fadein(obj.icon_color,obj.alpha),obj.icon.charCodeAt(0))}
	if(obj.icon){UI.DrawChar(obj.icon_font,obj.x+obj.x_shake+obj.padding,obj.y+obj.padding,obj.icon_color,obj.icon.charCodeAt(0))}
	//UI.DrawTextControl(tmp,obj.x+obj.x_shake+obj.padding+obj.w_icon,obj.y+obj.padding,fadein(obj.text_color,obj.alpha))
	UI.ED_RenderRichText(obj.m_cached_prt,obj.text,
		obj.x+obj.x_shake+obj.padding+obj.w_icon,obj.y+obj.padding)
	if(obj.OnClick){
		W.PureRegion(id,obj)
	}
	return obj
}

UI.SEARCH_FLAG_CASE_SENSITIVE=1;
UI.SEARCH_FLAG_WHOLE_WORD=2;
UI.SEARCH_FLAG_REGEXP=4;
UI.SEARCH_FLAG_FUZZY=8;
UI.SEARCH_FLAG_HIDDEN=16;
UI.SEARCH_FLAG_CODE_ONLY=32;
UI.SEARCH_FLAG_GOTO_MODE=1024;
UI.SEARCH_FLAG_GLOBAL=2048;
//only used in show_find_bar
UI.SEARCH_FLAG_SHOW=1048576;
UI.SHOW_FIND=UI.SEARCH_FLAG_SHOW;
UI.SHOW_GOTO=UI.SEARCH_FLAG_SHOW+UI.SEARCH_FLAG_GOTO_MODE;
UI.SHOW_GLOBAL_FIND=UI.SEARCH_FLAG_SHOW+UI.SEARCH_FLAG_GLOBAL;
UI.SHOW_GLOBAL_GOTO=UI.SEARCH_FLAG_SHOW+UI.SEARCH_FLAG_GLOBAL+UI.SEARCH_FLAG_GOTO_MODE;
(function(){
	if(!UI.m_ui_metadata["<find_state>"]){
		UI.m_ui_metadata["<find_state>"]={
			m_current_needle:"",
			m_binary_needle:"",
			m_find_flags:UI.SEARCH_FLAG_HIDDEN,
		}
	}
	if(!UI.m_ui_metadata["<projects>"]){
		UI.m_ui_metadata["<projects>"]=[];
	}
})();

var SetFindContextFinalResult=function(ctx,ccnt_center,matches){
	//should be sorted now
	//matches.sort(function(a,b){return a[0]-b[0];});
	var l=0
	var r=(matches.length>>1)-1
	while(l<=r){
		var m=(l+r)>>1
		var ccnt_m=matches[m*2+0]
		if(ccnt_m<ccnt_center){
			l=m+1;
		}else{
			r=m-1;
		}
	}
	ctx.m_forward_search_hack=matches.slice(l*2)
	ctx.m_backward_search_hack=matches.slice(0,l*2)
	if(ctx.m_forward_search_hack.length==0&&ctx.m_backward_search_hack.length>0){
		ctx.m_init_point_hack=-1
	}
	//ctx.m_forward_frontier=-1
	//ctx.m_backward_frontier=-1
}

var PrepareAPEM=function(){
	if(!UI.g_all_paths_ever_mentioned){
		UI.g_deep_search_cache={};
		if(UI.g_deep_include_jobs.length){
			//we have to restart... if there were new paths
			UI.g_deep_include_jobs[UI.g_deep_include_jobs.length-1].m_apem_progress=undefined;
		}
		UI.g_all_paths_ever_mentioned=[];
		var hist=UI.m_ui_metadata["<history>"];
		var arv={};
		for(var i=hist.length-1;i>=0;i--){
			var fn=hist[i];
			var fn_path=IO.NormalizeFileName(UI.GetPathFromFilename(fn));
			if(!arv[fn_path]){
				arv[fn_path]=1;
				UI.g_all_paths_ever_mentioned.push(fn_path);
			}
		}
	}
}

var g_is_parse_more_running=0;
//var g_need_reparse_dangling_deps=0;
var g_last_color_table_update=Duktape.__ui_get_tick();
var PARSING_SECONDS_PER_FRAME=1.0;
var PARSING_IDLE_REQUIREMENT=0.5;
var PARSING_COLOR_TABLE_UPDATE_INTERVAL=1.0;
UI.g_include_jobs=[];
UI.g_deep_include_jobs=[];
UI.g_dangling_include_jobs=[];
UI.g_deep_search_cache={};
var CallParseMore=function(){
	if(g_is_parse_more_running){return;}
	var fcallmore=UI.HackCallback(function(){
		var tick0=Duktape.__ui_get_tick();
		var is_done=0;
		var terminate_now=0;
		for(;;){
			while(UI.g_include_jobs.length>0){
				if(!(UI.g_include_jobs.length&127)){
					terminate_now|=!!UI.TestEventInPollJob();
					if(terminate_now){
						break;
					}
				}
				var ijob=UI.g_include_jobs.pop();
				var fn_found=UI.SearchIncludeFileShallow(ijob.fn_base,ijob.fn_include);
				//console.log(ijob.fn_include,JSON.stringify(fn_found));
				if(!fn_found){
					continue;
				}
				if(fn_found=="<dangling>"){
					UI.g_dangling_include_jobs.push(ijob);
					continue;
				}
				if(fn_found=="<deep>"){
					if(ijob.is_deferred!=2){
						//is_deferred==2: h to c
						UI.g_deep_include_jobs.push(ijob);
					}
					continue;
				}
				ijob.callback(fn_found,ijob.epos0,ijob.epos1,ijob.is_deferred);
			}
			if(terminate_now){UI.NextTick(fcallmore);break;}
			if(UI.g_deep_include_jobs.length>0){
				PrepareAPEM();
			}
			var work_load=0;
			while(UI.g_deep_include_jobs.length>0&&!terminate_now){
				//standard include paths
				var ijob=UI.g_deep_include_jobs.pop();
				var fn_found=undefined;
				var options=ijob.options;
				if(options.include_paths){
					var paths=options.include_paths
					for(var i=0;i<paths.length;i++){
						var fn=paths[i]+'/'+ijob.fn_include;
						work_load++;
						if(IO.FileExists(fn)){
							fn_found=fn;
							break;
						}
					}
				}
				if(!fn_found){
					fn_found=UI.g_deep_search_cache[ijob.fn_include];
				}
				if(fn_found==undefined){
					//all paths ever mentioned
					fn_found=null;
					var paths=UI.g_all_paths_ever_mentioned;
					for(var i=(ijob.m_apem_progress||0);i<paths.length;i++){
						var fn=paths[i]+'/'+ijob.fn_include;
						if(IO.FileExists(fn)){
							fn_found=fn;
							break;
						}
						work_load++;
						if(work_load>=MAX_MATCHES_IN_GLOBAL_SEARCH_RESULT){
							work_load=0;
							terminate_now|=!!UI.TestEventInPollJob();
							if(terminate_now){
								ijob.m_apem_progress=i+1;
								UI.g_deep_include_jobs.push(ijob);
								fn_found=undefined;
								break;
							}
						}
					}
					if(fn_found!=undefined){
						UI.g_deep_search_cache[ijob.fn_include]=fn_found;
					}
				}
				if(fn_found){
					ijob.callback(fn_found,ijob.epos0,ijob.epos1,ijob.is_deferred);
				}
			}
			if(terminate_now){UI.NextTick(fcallmore);break;}
			//var fn_parsing=(UI.ED_GetRemainingParsingJobs()||{}).fn_next;
			var ret=UI.ED_ParseMore()
			//var secs=Duktape.__ui_seconds_between_ticks(tick0,Duktape.__ui_get_tick());
			//if(secs>0.1){
			//	console.log(secs.toFixed(2),'UI.ED_ParseMore()',fn_parsing,IO.GetFileSize(fn_parsing));
			//}
			//tick0=Duktape.__ui_get_tick();
			if(ret){
				var doc_arr=UI.g_editor_from_file[ret.file_name];
				if(doc_arr){
					doc_arr.forEach(function(doc){
						if(doc&&doc.ed){
							doc.ed.m_file_index=ret.file_index;
						}
					})
				}
			}else if(!(UI.g_include_jobs.length>0)&&!(UI.g_deep_include_jobs.length>0)){
				g_is_parse_more_running=0;
				//if(g_need_reparse_dangling_deps){
				//	//avoid parse-git-parse loops: only do ED_ReparseDanglingDeps once after all other files have been parsed
				//	g_need_reparse_dangling_deps=0;
				//	if(UI.ED_ReparseDanglingDeps()){
				//		CallParseMore()
				//	}
				//}
				is_done=1;
				break;
			}
			var tick1=Duktape.__ui_get_tick()
			//print(Duktape.__ui_seconds_between_ticks(tick0,tick1))
			//if(UI.TestEventInPollJob())
			terminate_now|=!!(Duktape.__ui_seconds_between_ticks(tick0,tick1)>PARSING_SECONDS_PER_FRAME||UI.TestEventInPollJob());
			if(terminate_now){UI.NextTick(fcallmore);break;}
		}
		var tick1=Duktape.__ui_get_tick();
		if(is_done||Duktape.__ui_seconds_between_ticks(g_last_color_table_update,tick1)>PARSING_COLOR_TABLE_UPDATE_INTERVAL){
			g_last_color_table_update=tick1;
			UI.ED_InvalidatePrecomputedIndices();
			UI.RefreshAllTabs();
		}
	});
	g_is_parse_more_running=1;
	//in-global-search test
	//if(UI.g_is_in_global_search){
	//	fcallmore();
	//}else{
	UI.NextTick(fcallmore);
	//}
};

var ReparseDanglingDeps=function(){
	if(UI.g_dangling_include_jobs.length>0){
		for(var i=0;i<UI.g_dangling_include_jobs.length;i++){
			UI.g_include_jobs.push(UI.g_dangling_include_jobs[i]);
		}
		UI.g_dangling_include_jobs=[];
		CallParseMore();
	}
};

var fsave_code_editor=UI.HackCallback(function(){
	var doc=this.doc;
	var ctx=doc.ed.saving_context;
	if(doc.m_is_destroyed){
		ctx.discard();
		doc.ed.saving_context=undefined
		return;
	}
	var ret=UI.EDSaver_Write(ctx,doc.ed)
	if(ret=="done"){
		doc.saved_point=doc.ed.GetUndoQueueLength()
		this.ReleaseEditLock();
		ctx.discard();
		doc.ed.saving_context=undefined
		doc.ResetSaveDiff()
		doc.m_loaded_time=IO.GetFileTimestamp(this.file_name)
		this.OnSave();
		this.DismissNotification('saving_progress')
		UI.RefreshAllTabs()
	}else if(ret=="continue"){
		this.CreateNotification({id:'saving_progress',icon:undefined,text:"Saving @1%...".replace('@1',(ctx.progress*100).toFixed(0)),
			progress:ctx.progress
		},"quiet")
		UI.NextTick(fsave_code_editor.bind(this))
	}else{
		this.ReleaseEditLock();
		ctx.discard();
		doc.ed.saving_context=undefined
		this.CreateNotification({id:'saving_progress',icon:'错',text:"Failed to save it"})
	}
});

var find_item_region_prototype={
	OnMouseDown:function(event){
		var doc=this.doc;
		var ctx=this.owner;
		var ccnt=doc.SeekXY(event.x-this.x+this.scroll_x,event.y-this.y+this.scroll_y)
		var p_match=ctx.BisectMatches(doc,ccnt);
		if(p_match<ctx.m_forward_matches.length/3){
			var ccnt_l=ctx.GetMatchCcnt(p_match+0,1)
			var ccnt_r=ctx.GetMatchCcnt(p_match+1,0)
			if(Math.abs(ccnt_r-ccnt)<Math.abs(ccnt_l-ccnt)){
				p_match++;
			}
		}
		ctx.m_current_point=p_match;
		ctx.UpdateFindItemSelection()
		ctx.AutoScrollFindItems()
		if(event.clicks>1){
			var obj=ctx.m_owner;
			if(ctx){
				ctx.ConfirmFind();
			}
			obj.show_find_bar=0;
			obj.doc.AutoScroll('center')
			obj.doc.scrolling_animation=undefined
		}
		UI.Refresh()
	},
	OnMouseWheel:function(event){
		var ctx=this.owner;
		var obj=ctx.m_owner;
		if(obj.find_bar_edit){
			obj.find_bar_edit.OnMouseWheel(event)
		}
	}
};

//UI.g_is_in_global_search=0;
var find_context_prototype={
	CreateHighlight:function(doc,ccnt0,ccnt1){
		var locator_0=doc.ed.CreateLocator(ccnt0,-1);locator_0.undo_tracked=0;
		var locator_1=doc.ed.CreateLocator(ccnt1,-1);locator_1.undo_tracked=0;
		var hlobj=doc.ed.CreateHighlight(locator_0,locator_1,-1)
		hlobj.invertible=0;
		hlobj.display_mode=UI.HL_DISPLAY_MODE_RECTEX;
		hlobj.depth=1
		this.m_highlight_ranges.push(hlobj);
		this.m_locators.push(locator_0);
		this.m_locators.push(locator_1);
		UI.Refresh()
	},
	ReportMatchForward:function(doc,ccnt0,ccnt1){
		//print(doc.m_file_name,ccnt0,ccnt1)
		if(!(this.m_flags&UI.SEARCH_FLAG_HIDDEN)){
			if(doc.GetRenderer().IsRangeHidden(doc.ed,ccnt0,ccnt1)){
				return 1024;
			}
		}
		if((this.m_flags&UI.SEARCH_FLAG_CODE_ONLY)&&!doc.IsBracketEnabledAt(ccnt0)){
			return 1024;
		}
		if(this.m_flags&UI.SEARCH_FLAG_GLOBAL){
			var cell_desc=this.m_result_cell;
			if(cell_desc&&this.m_forward_matches.length<MAX_MATCHES_IN_GLOBAL_SEARCH_RESULT){
				var obj_notebook=cell_desc.obj_notebook;
				var cell_id=cell_desc.cell_id;
				var hint_items=[doc.m_file_name,':'];
				hint_items.push(ccnt0)
				hint_items.push('..')
				hint_items.push(ccnt1)
				//var lc0=doc.GetLC(ccnt0);
				//var lc1=doc.GetLC(ccnt1);
				//hint_items.push(lc0[0]+1)
				//hint_items.push(',')
				//hint_items.push(lc0[1]+1)
				//hint_items.push('-')
				//if(lc0!=lc1){
				//	hint_items.push(lc1[0]+1)
				//	hint_items.push(',')
				//}
				//hint_items.push(lc1[1]+1)
				//hint_items.push(': match "')
				hint_items.push(': ')
				hint_items.push(doc.ed.GetText(ccnt0,ccnt1-ccnt0))
				//hint_items.push('" (found)\n')
				hint_items.push('\n')
				obj_notebook.WriteCellOutput(cell_id,hint_items.join(""));
			}else if(cell_desc&&this.m_forward_matches.length==MAX_MATCHES_IN_GLOBAL_SEARCH_RESULT){
				obj_notebook.WriteCellOutput(cell_id,"additional matches omitted\n");
			}
		}
		this.m_forward_matches.push(ccnt0,ccnt1,doc)
		this.CreateHighlight(doc,ccnt0,ccnt1)
		return 1024
	},
	ReportMatchBackward:function(doc,ccnt0,ccnt1){
		if((this.m_flags&UI.SEARCH_FLAG_CODE_ONLY)&&!doc.IsBracketEnabledAt(ccnt0)){
			return 1024;
		}
		if(!(this.m_flags&UI.SEARCH_FLAG_HIDDEN)){
			if(doc.GetRenderer().IsRangeHidden(doc.ed,ccnt0,ccnt1)){
				return 1024;
			}
		}
		this.m_backward_matches.push(ccnt0,ccnt1,doc)
		this.CreateHighlight(doc,ccnt0,ccnt1)
		return 1024
	},
	Cancel:function(){
		for(var i=0;i<this.m_highlight_ranges.length;i++){
			this.m_highlight_ranges[i].discard()
		}
		for(var i=0;i<this.m_locators.length;i++){
			this.m_locators[i].discard()
		}
		if(this.m_temp_documents){
			for(var i=0;i<this.m_temp_documents.length;i++){
				UI.CloseCodeEditorDocument(this.m_temp_documents[i]);
			}
		}
		this.m_highlight_ranges=[];
		this.m_locators=[];
		this.m_temp_documents=undefined;
		//if(this.m_flags&UI.SEARCH_FLAG_GLOBAL){
		//	UI.g_is_in_global_search--;
		//}
	},
	///////////////////////
	SetRenderingHeight:function(h0){
		var edstyle=UI.default_styles.code_editor;
		this.m_current_visual_h=h0/edstyle.find_item_scale-edstyle.find_item_expand_current*this.m_hfont;
	},
	SeekMergedItemByUnmergedID:function(id){
		var l0=-((this.m_merged_y_windows_backward.length>>2)-1)
		var l=l0
		var r=(this.m_merged_y_windows_forward.length>>2)-1
		while(l<=r){
			var m=(l+r)>>1
			var fitem=this.GetFindItem(m)
			if(fitem.id<=id){
				l=m+1;
			}else{
				r=m-1;
			}
		}
		if(r<l0){r=l0;}
		return r
	},
	UpdateFindItemSelection:function(){
		this.m_owner.m_no_more_replace=0
		var id=this.m_current_point
		var r=this.SeekMergedItemByUnmergedID(id);
		var doc=this.GetMatchDoc(id);
		var fitem_current=this.GetFindItem(r)
		this.m_current_merged_item=r
		var renderer=doc.GetRenderer();
		var bk=renderer.m_enable_hidden;
		renderer.m_enable_hidden=((this.m_flags&UI.SEARCH_FLAG_HIDDEN)?0:1);
		this.m_current_visual_y=(doc.ed.XYFromCcnt(this.GetMatchCcnt(id,0))||{y:0}).y-fitem_current.scroll_y+fitem_current.visual_y
		renderer.m_enable_hidden=bk;
		////////////////////
		var hc=this.m_hfont;
		var edstyle=UI.default_styles.code_editor
		//obtain params from style
		var find_shared_h=this.m_current_visual_h;
		var h_bof_eof_message_with_sep=UI.GetCharacterHeight(edstyle.find_message_font)+edstyle.find_item_separation*2;
		var ccnt_match0=this.GetMatchCcnt(id,0)
		var ccnt_match1=((this.m_flags&UI.SEARCH_FLAG_GOTO_MODE)?ccnt_match0:this.GetMatchCcnt(id,1))
		if(doc.sel0.ccnt!=ccnt_match0||doc.sel1.ccnt!=ccnt_match1){
			UI.SetSelectionEx(doc,ccnt_match0,ccnt_match1,(this.m_flags&UI.SEARCH_FLAG_GOTO_MODE)?"goto":"find")
		}
		if(this.m_last_auto_scrolled_point!=this.m_current_point){
			this.m_last_auto_scrolled_point=this.m_current_point;
			doc.AutoScroll("show")
			this.AutoScrollFindItems()
		}else{
			this.ValidateFindItemScroll()
		}
	},
	AutoScrollFindItems:function(){
		var fitem_current=this.GetFindItem(this.m_current_merged_item)
		var find_shared_h=this.m_current_visual_h;
		var edstyle=UI.default_styles.code_editor
		var h_bof_eof_message_with_sep=UI.GetCharacterHeight(edstyle.find_message_font)+edstyle.find_item_separation*2;
		this.m_find_scroll_visual_y=Math.min(Math.max(this.m_find_scroll_visual_y,
			this.m_current_visual_y+fitem_current.shared_h+h_bof_eof_message_with_sep-find_shared_h),
			this.m_current_visual_y-h_bof_eof_message_with_sep-edstyle.find_item_expand_current*this.m_hfont*0.5)
		this.ValidateFindItemScroll()
	},
	GetFindItemsScrollRange:function(){
		var find_shared_h=this.m_current_visual_h;
		var edstyle=UI.default_styles.code_editor
		var h_bof_eof_message_with_sep=UI.GetCharacterHeight(edstyle.find_message_font)+edstyle.find_item_separation*2;
		return [
			this.m_y_extent_backward-h_bof_eof_message_with_sep,
			this.m_y_extent_forward+h_bof_eof_message_with_sep-find_shared_h];
	},
	ValidateFindItemScroll:function(){
		var find_shared_h=this.m_current_visual_h;
		var edstyle=UI.default_styles.code_editor
		var h_bof_eof_message_with_sep=UI.GetCharacterHeight(edstyle.find_message_font)+edstyle.find_item_separation*2;
		this.m_find_scroll_visual_y=Math.max(Math.min(
			this.m_find_scroll_visual_y,
			this.m_y_extent_forward+h_bof_eof_message_with_sep-find_shared_h),
			this.m_y_extent_backward-h_bof_eof_message_with_sep)
		//print(this.m_find_scroll_visual_y,this.m_current_visual_y,this.m_current_point,r,JSON.stringify(fitem_current));
	},
	IsForwardSearchCompleted:function(){
		if(!UI.IsSearchFrontierCompleted(this.m_forward_frontier)){
			return 0;
		}
		if(this.m_flags&UI.SEARCH_FLAG_GLOBAL){
			return !this.m_search_doc&&this.m_p_repo_files>=this.m_repo_files.length;
		}else{
			return 1;
		}
	},
	RenderVisibleFindItems:function(w_line_numbers,w_find_items,h_rendering){
		this.SetRenderingHeight(h_rendering);
		var h_find_items=this.m_current_visual_h;
		this.UpdateFindItemSelection();
		var id=this.m_current_point;
		var doc_curpoint=this.GetMatchDoc(id);
		var renderer=doc_curpoint.GetRenderer();
		if(this.m_flags&UI.SEARCH_FLAG_FUZZY){
			if(!this.m_fuzzy_virtual_diffs||this.m_fuzzy_diff_match_id!=id){
				//fuzzy match rendering - GetMatchCcnt, something else like m_tentative_editops but rendered the other direction
				this.m_fuzzy_virtual_diffs=UI.ED_RawEditDistance(doc_curpoint.ed,
					this.GetMatchCcnt(id,0),this.GetMatchCcnt(id,1),
					this.m_needle, this.m_flags&UI.SEARCH_FLAG_CASE_SENSITIVE);
				this.m_fuzzy_diff_match_id=id;
			}
		}
		if(this.m_fuzzy_virtual_diffs){
			renderer.m_virtual_diffs=this.m_fuzzy_virtual_diffs;
		}
		var edstyle=UI.default_styles.code_editor;
		var hc=this.m_hfont;
		var h_bof_eof_message=UI.GetCharacterHeight(edstyle.find_message_font)+edstyle.find_item_separation;
		var eps=hc/16;
		var ccnt_middle=this.GetMatchCcnt(this.m_current_point,1)
		var xy_middle=doc_curpoint.ed.XYFromCcnt(ccnt_middle)
		var find_scroll_x=Math.max(xy_middle.x-(w_find_items-w_line_numbers),0)
		var find_scroll_y=this.m_find_scroll_visual_y
		var obj_parent=UI.context_parent;
		var was_just_reset=this.m_is_just_reset;
		if(this.m_is_just_reset){
			//don't animate the first round
			this.m_is_just_reset=0;
			obj_parent.find_item_scrolling=undefined;
		}
		var anim_node=W.AnimationNode("find_item_scrolling",{
			scroll_x:find_scroll_x,
			scroll_y:find_scroll_y,
		})
		find_scroll_x=anim_node.scroll_x;
		find_scroll_y=anim_node.scroll_y;
		var find_shared_h=this.m_current_visual_h;
		var ccnt_tot=doc_curpoint.ed.GetTextSize()
		var ytot=doc_curpoint.ed.XYFromCcnt(ccnt_tot).y+doc_curpoint.ed.GetCharacterHeightAt(ccnt_tot);
		var h_safety=hc*edstyle.find_item_expand_current;
		var h_safety_internal=h_safety+h_find_items//for page up/down
		//search-on-render
		if(find_scroll_y<this.m_y_extent_backward+h_safety_internal&&!UI.IsSearchFrontierCompleted(this.m_backward_frontier)){
			UI.assert(!(this.m_flags&UI.SEARCH_FLAG_GLOBAL));
			var p0=this.m_backward_matches.length
			if(this.m_backward_search_hack){
				var matches=this.m_backward_search_hack
				this.m_backward_search_hack=undefined
				for(var i=matches.length-2;i>=0;i-=2){
					this.ReportMatchBackward(doc_curpoint,matches[i+0],matches[i+1])
				}
				this.m_is_just_reset=1;
				this.m_backward_frontier=-1
				UI.InvalidateCurrentFrame();
			}else{
				this.m_backward_frontier=UI.ED_Search(doc_curpoint.ed,this.m_backward_frontier,-1,this.m_needle,this.m_flags,262144,this.ReportMatchBackward.bind(this,doc_curpoint),this)
			}
			//var ccnt_merged_anyway=this.m_mergable_ccnt_backward
			var current_y1=this.m_merged_y_windows_backward.pop()
			var current_y0=this.m_merged_y_windows_backward.pop()
			var current_visual_y=this.m_merged_y_windows_backward.pop()
			var current_id=this.m_merged_y_windows_backward.pop()
			current_y1+=current_y0
			var match_ccnts0=[];
			for(var pmatch=p0;pmatch<this.m_backward_matches.length;pmatch+=3){
				match_ccnts0.push(this.m_backward_matches[pmatch])
			}
			var match_ccnts=[]
			for(var i=match_ccnts0.length-1;i>=0;i--){
				match_ccnts.push(match_ccnts0[i]);
			}
			var match_xys=doc_curpoint.ed.GetXYEnMasse(match_ccnts)
			for(var pmatch=p0;pmatch<this.m_backward_matches.length;pmatch+=3){
				var ccnt_id=this.m_backward_matches[pmatch]
				//if(ccnt_id>=ccnt_merged_anyway){current_id=-1-(pmatch/3);continue;}
				var y_id=match_xys[(match_ccnts.length-1-(pmatch-p0)/3)*2+1];//doc_curpoint.ed.XYFromCcnt(ccnt_id).y
				var y_id0=Math.max(y_id-hc*this.m_context_size,0),y_id1=Math.min(y_id+hc*(this.m_context_size+1),ytot)
				if(y_id1>current_y0-eps){
					//merge
					current_visual_y-=Math.max(current_y0-y_id0,0)
					current_id=-1-(pmatch/3)
					current_y0=y_id0
				}else{
					this.m_merged_y_windows_backward.push(current_id,current_visual_y,current_y0,current_y1-current_y0)
					current_id=-1-(pmatch/3)
					current_y0=y_id0
					current_y1=y_id1
					current_visual_y-=y_id1-y_id0+edstyle.find_item_separation
				}
				//ccnt_merged_anyway=doc_curpoint.ed.SeekXY(0,y_id)
			}
			this.m_merged_y_windows_backward.push(current_id,current_visual_y,current_y0,current_y1-current_y0)
			//this.m_mergable_ccnt_backward=ccnt_merged_anyway
			this.m_merged_y_windows_forward[0]=this.m_merged_y_windows_backward[0]
			this.m_merged_y_windows_forward[1]=this.m_merged_y_windows_backward[1]
			this.m_merged_y_windows_forward[2]=this.m_merged_y_windows_backward[2]
			this.m_merged_y_windows_forward[3]=this.m_merged_y_windows_backward[3]
			this.m_y_extent_backward=current_visual_y
			if(this.m_home_end=='home'){
				this.m_current_point=-(this.m_backward_matches.length/3)
				if(UI.IsSearchFrontierCompleted(this.m_backward_frontier)){
					this.m_home_end=undefined
				}
			}
			if(this.m_home_end=='init'){
				if(this.m_init_point_hack!=undefined){
					this.m_current_point=this.m_init_point_hack
					this.m_home_end=undefined
				}else if(this.m_backward_matches.length>0&&(this.m_flags&UI.SEARCH_FLAG_GOTO_MODE)&&!this.m_needle){
					this.m_current_point=-1
					this.m_home_end=undefined
				}
			}
			UI.Refresh()
		}
		//var FORWARD_BUDGET=262144;
		var FORWARD_BUDGET=1048576;
		for(;;){
			//repeate forward search for small files in global mode
			if(this.m_flags&UI.SEARCH_FLAG_GLOBAL){
				if(this.m_repo_path&&!this.m_repo_files){
					var repo=g_repo_list[this.m_repo_path]
					if(!repo.is_parsing){
						this.m_repo_files=repo.files.filter(function(fn){
							var repos=g_repo_from_file[fn]
							if(repos&&(repos[this.m_repo_path]=='!!'||repos[this.m_repo_path]=='??')){
								//do not search ignored / untracked files -- even though we show them in the project listing
								return 0;
							}
							if(this.m_flags&UI.SEARCH_FLAG_GOTO_MODE){
								return UI.ED_GetFileLanguage(fn).parser=="C";
							}else{
								return !UI.ED_GetFileLanguage(fn).is_binary;
							}
						}.bind(this));
						this.m_p_repo_files=0;
						if(!this.m_temp_documents){
							this.m_temp_documents=[];
						}
						this.m_doc_ordering={};
						this.m_sel_backups={};
						for(var i=0;i<this.m_repo_files.length;i++){
							this.m_doc_ordering[this.m_repo_files[i]]=i;
						}
					}else{
						break;
					}
				}
				if(this.m_repo_files&&UI.IsSearchFrontierCompleted(this.m_forward_frontier)){
					if(!this.m_search_doc&&this.m_p_repo_files<this.m_repo_files.length){
						//try to search beyond the current file, keep doc in m_temp_documents
						var doc_next=UI.OpenCodeEditorDocument(this.m_repo_files[this.m_p_repo_files]);
						this.m_p_repo_files++;
						this.m_search_doc=doc_next;
						if(!doc_next.ed){doc_next.Init();}
						this.m_temp_documents.push(doc_next)
					}
					if(this.m_search_doc){
						if(!this.m_search_doc.ed.hfile_loading){
							//we could start searching!
							this.m_sel_backups[this.m_search_doc.m_file_name]=[this.m_search_doc.sel0.ccnt,this.m_search_doc.sel1.ccnt];
							this.m_forward_frontier=0;
						}else{
							break;
						}
					}
				}
			}
			if((find_scroll_y+find_shared_h>this.m_y_extent_forward-h_safety_internal||(this.m_flags&UI.SEARCH_FLAG_GLOBAL))&&
			!UI.IsSearchFrontierCompleted(this.m_forward_frontier)){
				var doc_forward_search=(this.m_flags&UI.SEARCH_FLAG_GLOBAL)?this.m_search_doc:doc_curpoint;
				ccnt_tot=doc_forward_search.ed.GetTextSize()
				ytot=doc_forward_search.ed.XYFromCcnt(ccnt_tot).y+doc_forward_search.ed.GetCharacterHeightAt(ccnt_tot);
				var p0=this.m_forward_matches.length
				if((this.m_flags&UI.SEARCH_FLAG_GLOBAL)&&(this.m_flags&UI.SEARCH_FLAG_GOTO_MODE)){
					//global goto
					if(!UI.IsSearchFrontierCompleted(this.m_forward_frontier)&&!g_is_parse_more_running){
						if(doc_forward_search.ed.m_file_index&&doc_forward_search.ed.m_file_index.hasDecls()){
							var matches=(UI.ED_QueryKeyDeclByNeedle(doc_forward_search,this.m_needle)||[]);
							for(var i=0;i<matches.length;i+=2){
								this.ReportMatchForward(doc_forward_search,matches[i+0],matches[i+1])
							}
							FORWARD_BUDGET-=matches.length*64;
						}
						this.m_search_doc=undefined;
						this.m_forward_frontier=-1;
					}else{
						break;
					}
				}else if(this.m_forward_search_hack){
					var matches=this.m_forward_search_hack
					this.m_forward_search_hack=undefined
					for(var i=0;i<matches.length;i+=2){
						this.ReportMatchForward(doc_forward_search,matches[i+0],matches[i+1])
					}
					this.m_is_just_reset=1;
					this.m_forward_frontier=-1
					UI.InvalidateCurrentFrame();
				}else{
					this.m_forward_frontier=UI.ED_Search(doc_forward_search.ed,this.m_forward_frontier,1,this.m_needle,this.m_flags,FORWARD_BUDGET,this.ReportMatchForward.bind(this,doc_forward_search),this);
					if(UI.IsSearchFrontierCompleted(this.m_forward_frontier)&&(this.m_flags&UI.SEARCH_FLAG_GLOBAL)){
						//clear out m_search_doc to open the next file
						this.m_search_doc=undefined;
						this.m_forward_frontier=-1;
						FORWARD_BUDGET-=doc_forward_search.ed.GetTextSize()*((this.m_flags&UI.SEARCH_FLAG_REGEXP)?16:1);
						FORWARD_BUDGET-=4096;
					}else{
						FORWARD_BUDGET=-1;
					}
				}
				//var ccnt_merged_anyway=this.m_mergable_ccnt_forward
				var current_y1=this.m_merged_y_windows_forward.pop()
				var current_y0=this.m_merged_y_windows_forward.pop()
				var current_visual_y=this.m_merged_y_windows_forward.pop()
				var current_id=this.m_merged_y_windows_forward.pop()
				current_y1+=current_y0
				var match_ccnts=[];
				for(var pmatch=p0;pmatch<this.m_forward_matches.length;pmatch+=3){
					match_ccnts.push(this.m_forward_matches[pmatch])
				}
				var match_xys=doc_forward_search.ed.GetXYEnMasse(match_ccnts)
				for(var pmatch=p0;pmatch<this.m_forward_matches.length;pmatch+=3){
					var ccnt_id=this.m_forward_matches[pmatch]
					//if(ccnt_id<=ccnt_merged_anyway){continue;}
					var y_id=match_xys[(pmatch-p0)/3*2+1];//doc_forward_search.ed.XYFromCcnt(ccnt_id).y
					var y_id0=Math.max(y_id-hc*this.m_context_size,0),y_id1=Math.min(y_id+hc*(this.m_context_size+1),ytot)
					if(y_id0<current_y1+eps&&(!(this.m_flags&UI.SEARCH_FLAG_GLOBAL)||this.m_forward_matches[pmatch+2]==this.m_forward_matches[pmatch+(2-3)])){
						//merge
						current_y1=y_id1
					}else{
						if((this.m_flags&UI.SEARCH_FLAG_GLOBAL)&&current_id==0){
							//we don't want the zero-th thing in a global search
						}else{
							this.m_merged_y_windows_forward.push(current_id,current_visual_y,current_y0,current_y1-current_y0)
							current_visual_y+=current_y1-current_y0+edstyle.find_item_separation
						}
						current_id=(pmatch/3)+1
						current_y0=y_id0
						current_y1=y_id1
					}
					//ccnt_merged_anyway=doc_forward_search.ed.SeekXY(1e17,y_id)
				}
				this.m_merged_y_windows_forward.push(current_id,current_visual_y,current_y0,current_y1-current_y0)
				//this.m_mergable_ccnt_forward=ccnt_merged_anyway
				this.m_merged_y_windows_backward[0]=this.m_merged_y_windows_forward[0]
				this.m_merged_y_windows_backward[1]=this.m_merged_y_windows_forward[1]
				this.m_merged_y_windows_backward[2]=this.m_merged_y_windows_forward[2]
				this.m_merged_y_windows_backward[3]=this.m_merged_y_windows_forward[3]
				this.m_y_extent_forward=current_visual_y+current_y1-current_y0
				if(this.m_home_end=='end'){
					this.m_current_point=(this.m_forward_matches.length/3)
					if(this.IsForwardSearchCompleted()){
						this.m_home_end=undefined
					}
				}
				if(this.m_home_end=='init'){
					if(this.m_forward_matches.length>0&&!((this.m_flags&UI.SEARCH_FLAG_GOTO_MODE)&&!this.m_needle)){
						this.m_current_point=1
						this.m_home_end=undefined
					}else if(this.IsForwardSearchCompleted()){
						this.m_home_end=undefined
					}
				}
				UI.Refresh()
			}else{
				break;
			}
			if(!(this.m_flags&UI.SEARCH_FLAG_GLOBAL)||!(FORWARD_BUDGET>0)){break;}
		}
		var p0=this.BisectFindItems(find_scroll_y-h_safety)
		var p1=this.BisectFindItems(find_scroll_y+find_shared_h+h_safety)
		if(p0==-((this.m_merged_y_windows_backward.length>>2)-1)){
			//BOF
			var s_bof_message;
			if(this.m_flags&UI.SEARCH_FLAG_GLOBAL){
				if(!UI.IsSearchFrontierCompleted(this.m_forward_frontier)){
					ccnt_tot=this.m_search_doc.ed.GetTextSize()
					s_bof_message=UI.Format("Searching '@1' @2%",
						this.m_search_doc.m_file_name,
						((UI.GetSearchFrontierCcnt(this.m_forward_frontier)/ccnt_tot)*100).toFixed(0))
				}else{
					if(!this.m_repo_path){
						s_bof_message=UI._("'@1' is not a part of any known project").replace("@1",this.m_base_file)
					}else if(!this.m_repo_files){
						s_bof_message=UI._("Listing project files...")
					}else if(this.m_search_doc&&this.m_search_doc.ed.hfile_loading){
						s_bof_message=UI.Format("Loading '@1' @2%",
							this.m_search_doc.m_file_name,
							(this.m_search_doc.ed.hfile_loading.progress*100).toFixed(0));
					}else if(!this.m_search_doc&&this.m_p_repo_files<this.m_repo_files.length){
						s_bof_message=UI.Format("Loading '@1' @2%",
							this.m_repo_files[this.m_p_repo_files],
							"0");
					}else{
						s_bof_message=UI._("All files searched")
					}
				}
			}else{
				if(!UI.IsSearchFrontierCompleted(this.m_backward_frontier)){
					s_bof_message=UI._("Searching @1%").replace("@1",((1-UI.GetSearchFrontierCcnt(this.m_backward_frontier)/ccnt_tot)*100).toFixed(0))
				}else if((this.m_flags&UI.SEARCH_FLAG_GOTO_MODE)&&this.m_goto_line_number!=undefined){
					s_bof_message=UI._("Go to line @1").replace("@1",this.m_goto_line_number.toString())
				}else{
					s_bof_message=UI._("No more '@1' above").replace("@1",this.m_needle)
				}
			}
			var text_dim=UI.MeasureText(edstyle.find_message_font,s_bof_message)
			var y=this.m_y_extent_backward-find_scroll_y-h_bof_eof_message
			W.Text("",{
				x:(w_find_items-text_dim.w)*0.5,y:y,
				font:edstyle.find_message_font,color:edstyle.find_message_color,
				text:s_bof_message})
		}
		//actual rendering
		for(var i=p0;i<=p1;i++){
			var find_item_i=this.GetFindItem(i)
			var h_expand=0
			if(i==this.m_current_merged_item){
				h_expand=hc*edstyle.find_item_expand_current;
			}
			var nodekey="find_item_"+i.toString();
			if(was_just_reset){obj_parent[nodekey]=undefined;}
			h_expand=W.AnimationNode(nodekey,{
				h_expand:h_expand,
			}).h_expand;
			find_scroll_y-=h_expand*0.5
			//draw the shadow
			var doc_render=this.GetMatchDoc(find_item_i.id);
			if(this.m_flags&UI.SEARCH_FLAG_GLOBAL){
				ccnt_tot=doc_render.ed.GetTextSize()
				ytot=doc_render.ed.XYFromCcnt(ccnt_tot).y+doc_render.ed.GetCharacterHeightAt(ccnt_tot);
			}
			var doc_h=find_item_i.shared_h+h_expand
			var doc_scroll_y=Math.max(Math.min(find_item_i.scroll_y-h_expand*0.5,ytot-doc_h),0)
			var y=find_item_i.visual_y-find_scroll_y-h_expand*0.5;
			var h=doc_h;
			UI.PushCliprect(0,y+h,w_find_items,edstyle.find_item_separation)
				UI.RoundRect({x:0-edstyle.find_item_shadow_size,y:y+h-edstyle.find_item_shadow_size,w:w_find_items+edstyle.find_item_shadow_size*2,h:edstyle.find_item_shadow_size*2,
					color:edstyle.find_item_shadow_color,
					round:edstyle.find_item_shadow_size,
					border_width:-edstyle.find_item_shadow_size})
			UI.PopCliprect()
			//draw the main part
			doc_render.RenderWithLineNumbers(
				find_scroll_x,doc_scroll_y,
				0,y,
				w_find_items,doc_h,0)
			if(this.m_flags&UI.SEARCH_FLAG_GLOBAL){
				var fn_display=IO.NormalizeFileName(doc_render.m_file_name,1);
				var s_repo_path=this.m_repo_path;
				if(doc_render.m_file_name.length>s_repo_path.length+1&&doc_render.m_file_name.substr(0,s_repo_path.length)==s_repo_path){
					fn_display=fn_display.substr(s_repo_path.length+1);
				}
				var text_dim=UI.MeasureText(edstyle.find_message_font,fn_display)
				if(i==this.m_current_merged_item){
					UI.RoundRect({
						x:(w_find_items-8-text_dim.w),y:y,
						w:text_dim.w,h:text_dim.h,
						round:2,
						color:edstyle.bgcolor&0xaaffffff,
					})
				}
				W.Text("",{
					x:(w_find_items-8-text_dim.w),y:y,
					font:edstyle.find_message_font,color:edstyle.editor_style.color_symbol,
					text:fn_display})
			}
			var y_clipped=Math.max(y,0);
			W.Region("R_find_item_"+i.toString(),{
				x:0,y:y_clipped,
				w:w_find_items,h:Math.min(y+doc_h,h_rendering/edstyle.find_item_scale)-y_clipped,
				owner:this,
				doc:doc_render,
				scroll_x:find_scroll_x,
				scroll_y:doc_scroll_y,
			},find_item_region_prototype)
			var h_expand_max=hc*edstyle.find_item_expand_current
			var highlight_alpha=h_expand/h_expand_max;
			var alpha=Math.max(Math.min(((1-highlight_alpha)*96)|0,255),0)
			var bgcolor=edstyle.find_mode_bgcolor;
			if(this.m_flags&UI.SEARCH_FLAG_FUZZY){
				//do not animate the disclaimer
				bgcolor=edstyle.disclaimer_color;
			}
			UI.RoundRect({color:(bgcolor&0xffffff)|(alpha<<24),x:0,y:y,w:w_find_items,h:h})
			find_scroll_y-=h_expand*0.5;
		}
		if(p1==(this.m_merged_y_windows_forward.length>>2)-1){
			//EOF
			var s_eof_message;
			if(!UI.IsSearchFrontierCompleted(this.m_forward_frontier)){
				if(this.m_search_doc){
					ccnt_tot=this.m_search_doc.ed.GetTextSize()
					s_eof_message=UI.Format("Searching '@1' @2%",
						this.m_search_doc.m_file_name,
						((UI.GetSearchFrontierCcnt(this.m_forward_frontier)/ccnt_tot)*100).toFixed(0))
				}else{
					s_eof_message=UI._("Searching @1%").replace("@1",((UI.GetSearchFrontierCcnt(this.m_forward_frontier)/ccnt_tot)*100).toFixed(0))
				}
			}else if((this.m_flags&UI.SEARCH_FLAG_GOTO_MODE)&&this.m_goto_line_number!=undefined){
				s_eof_message=UI._("Go to line @1").replace("@1",this.m_goto_line_number.toString())
			}else if((this.m_flags&UI.SEARCH_FLAG_GLOBAL)){
				if(!this.m_repo_path){
					s_eof_message=UI._("'@1' is not a part of any known project").replace("@1",this.m_base_file)
				}else if(!this.m_repo_files){
					s_eof_message=UI._("Listing project files...")
				}else if(this.m_search_doc&&this.m_search_doc.ed.hfile_loading){
					s_eof_message=UI.Format("Loading '@1' @2%",
						this.m_search_doc.m_file_name,
						(this.m_search_doc.ed.hfile_loading.progress*100).toFixed(0));
				}else if(!this.m_search_doc&&this.m_p_repo_files<this.m_repo_files.length){
					s_eof_message=UI.Format("Loading '@1' @2%",
						this.m_repo_files[this.m_p_repo_files],
						"0");
				}else{
					s_eof_message=UI._("All files searched, found @1").replace("@1",((this.m_forward_matches.length+this.m_backward_matches.length)/3).toString())
				}
			}else{
				s_eof_message=UI.Format("No more '@1' below, found @2",this.m_needle,((this.m_forward_matches.length+this.m_backward_matches.length)/3).toString())
			}
			var text_dim=UI.MeasureText(edstyle.find_message_font,s_eof_message)
			var y=this.m_y_extent_forward-find_scroll_y+edstyle.find_item_separation
			W.Text("",{
				x:(w_find_items-text_dim.w)*0.5,y:y,
				font:edstyle.find_message_font,color:edstyle.find_message_color,
				text:s_eof_message})
		}
	},
	GetFindItem:function(id){
		var arr,ofs;
		if(id<0){
			ofs=-id
			arr=this.m_merged_y_windows_backward
		}else{
			ofs=id
			arr=this.m_merged_y_windows_forward
		}
		ofs<<=2
		return {id:arr[ofs+0],visual_y:arr[ofs+1],scroll_y:arr[ofs+2],shared_h:arr[ofs+3]}
	},
	BisectFindItems:function(y){
		var l0=-((this.m_merged_y_windows_backward.length>>2)-1);
		var l=l0;
		var r=(this.m_merged_y_windows_forward.length>>2)-1
		while(l<=r){
			var m=(l+r)>>1
			var fitem=this.GetFindItem(m)
			if(fitem.visual_y<=y){
				l=m+1;
			}else{
				r=m-1;
			}
		}
		return Math.max(r,l0);
	},
	GetMatchDoc:function(id){
		if(id==0||!(this.m_flags&UI.SEARCH_FLAG_GLOBAL)){
			return this.m_starting_doc;
		}else if(id<0){
			var ofs=(id+1)*(-3)+2
			if(ofs<this.m_backward_matches.length){
				return this.m_backward_matches[ofs]
			}
		}else{
			var ofs=(id-1)*3+2
			if(ofs<this.m_forward_matches.length){
				return this.m_forward_matches[ofs]
			}
		}
		return undefined
	},
	GetMatchCcnt:function(id,side){
		if(id==0){
			return side==0?this.m_starting_ccnt0:this.m_starting_ccnt1;
		}else if(id<0){
			var ofs=(id+1)*(-3)+side
			if(ofs<this.m_backward_matches.length){
				return this.m_backward_matches[ofs]
			}
		}else{
			var ofs=(id-1)*3+side
			if(ofs<this.m_forward_matches.length){
				return this.m_forward_matches[ofs]
			}
		}
		return undefined
	},
	BisectMatches:function(doc,ccnt){
		var docid=(this.m_doc_ordering?this.m_doc_ordering[doc.m_file_name]:0);
		var l0=-(this.m_backward_matches.length/3)
		//if((this.m_flags&UI.SEARCH_FLAG_GLOBAL)&&this.m_forward_matches.length>0){
		//	l0=1;
		//}
		var l=l0
		var r=(this.m_forward_matches.length/3)
		while(l<=r){
			var m=(l+r)>>1
			var ccnt_m=this.GetMatchCcnt(m,0)
			var doc_m=this.GetMatchDoc(m)
			var docid_m=(this.m_doc_ordering?this.m_doc_ordering[doc_m.m_file_name]:0);
			//print(m,docid_m,doc_m.m_file_name,docid_m,doc.m_file_name,docid)
			if(docid_m<docid||docid_m==docid&&ccnt_m<=ccnt){
				l=m+1;
			}else{
				r=m-1;
			}
		}
		if(r<l0){r=l0;}
		return r;
	},
	//visual y -> bsearch -> scroll_y -> ccnt -> bsearch -> match id
	SeekFindItemByVisualY:function(visual_y,scroll_x){
		//visual y -> bsearch -> scroll_y
		var l0=-((this.m_merged_y_windows_backward.length>>2)-1);
		var l=l0;
		var r=(this.m_merged_y_windows_forward.length>>2)-1
		var id=this.m_current_point
		while(l<=r){
			var m=(l+r)>>1
			var fitem=this.GetFindItem(m)
			if(fitem.visual_y<=visual_y){
				l=m+1;
			}else{
				r=m-1;
			}
		}
		if(r<l0){r=l0;}
		//scroll_y -> ccnt
		var fitem=this.GetFindItem(r)
		var scroll_y=visual_y-fitem.visual_y+fitem.scroll_y
		var doc=this.GetMatchDoc(fitem.id)
		var ccnt=doc.ed.SeekXY(scroll_x,scroll_y)
		//ccnt -> bsearch -> match id
		this.m_current_point=this.BisectMatches(doc,ccnt)
		//this.m_current_point=fitem.id;
		//print(id,fitem.id,visual_y);
	},
	ConfirmFind:function(){
		var id=this.m_current_point;
		var doc=this.GetMatchDoc(id);
		var renderer=doc.GetRenderer();
		var sel=doc.GetSelection();
		renderer.ShowRange(doc.ed,sel[0],sel[1]);
		if(this.m_flags&UI.SEARCH_FLAG_GLOBAL){
			UI.OpenEditorWindow(doc.m_file_name);
		}
		this.m_confirmed=1;
		UI.SetFocus(doc);
	},
	RestoreSel:function(){
		if(this.m_flags&UI.SEARCH_FLAG_GLOBAL){
			if(this.m_temp_documents&&this.m_sel_backups){
				for(var i=0;i<this.m_temp_documents.length;i++){
					var doc=this.m_temp_documents[i];
					var bksel=this.m_sel_backups[doc.m_file_name];
					if(bksel){
						doc.sel0.ccnt=bksel[0];
						doc.sel1.ccnt=bksel[1];
						doc.AutoScroll('center');
						doc.scrolling_animation=undefined
					}
				}
			}
		}else{
			var doc=this.m_starting_doc;
			doc.sel0.ccnt=this.m_sel0_before_find
			doc.sel1.ccnt=this.m_sel1_before_find
			doc.AutoScroll('center')
			doc.scrolling_animation=undefined
		}
	},
	CancelFind:function(){
		this.RestoreSel();
		var obj=this.m_owner
		obj.show_find_bar=0;
		UI.Refresh()
	},
};

//initiator + mark
UI.OpenNotebookCellFromEditor=function(doc,s_mark,s_language,create_if_not_found,is_non_quiet){
	var spath_repo=UI.GetNotebookProject(doc.m_file_name);
	var obj_notebook_tab=UI.OpenNoteBookTab(spath_repo+"/notebook.json",'quiet');
	if(is_non_quiet){
		UI.top.app.document_area.BringUpTab(obj_notebook_tab.__global_tab_id)
	}
	if(!obj_notebook_tab.main_widget){
		obj_notebook_tab.NeedMainWidget();
	}
	var obj_notebook=obj_notebook_tab.main_widget;
	var cell_id=obj_notebook.GetSpecificCell(s_mark,s_language,create_if_not_found)
	if(cell_id<0){return undefined;}
	if(is_non_quiet){
		//UI.SetFocus(obj_notebook.m_cells[cell_id].m_text_in);
		obj_notebook.GotoSubCell(cell_id*2+(is_non_quiet=="output"?1:0));
		//obj_notebook.need_auto_scroll=1;
		var cell_i=(obj_notebook.m_cells&&obj_notebook.m_cells[cell_id]);
		if(cell_i&&is_non_quiet!="output"){
			UI.SetFocus(is_non_quiet=="output"?cell_i.m_text_out:cell_i.m_text_in)
		}
		UI.RefreshAllTabs();
	}
	return {obj_notebook:obj_notebook,cell_id:cell_id};
}

var CreateFindContext=function(obj,doc, sneedle,flags,ccnt0,ccnt1){
	var hc=UI.GetCharacterHeight(UI.default_styles.code_editor.editor_style.font)
	var ccnt_tot=doc.ed.GetTextSize()
	var ytot=doc.ed.XYFromCcnt(ccnt_tot).y+doc.ed.GetCharacterHeightAt(ccnt_tot);
	var ctx={
		m_hfont:hc,
		m_original_frontier:ccnt1,
		m_is_just_reset:1,
		m_forward_matches:[],
		m_forward_frontier:(flags&UI.SEARCH_FLAG_GLOBAL)?-1:ccnt1,
		m_backward_matches:[],
		m_backward_frontier:(flags&UI.SEARCH_FLAG_GLOBAL)?-1:ccnt1,
		m_highlight_ranges:[],
		m_locators:[],
		m_owner:obj,
		m_starting_doc:doc,
		m_starting_ccnt0:ccnt0,
		m_starting_ccnt1:ccnt1,
		m_current_point:0,
		m_needle:sneedle,
		m_flags:flags,
		m_find_scroll_visual_y:-(obj.h/obj.find_item_scale-obj.find_item_expand_current*hc)*0.5,
		m_home_end:'init',
		m_context_size:(flags&UI.SEARCH_FLAG_GOTO_MODE)?obj.find_item_context_goto:obj.find_item_context_find,
		///////////////////////////////
		m_merged_y_windows_backward:[],
		m_merged_y_windows_forward:[],
		//m_mergable_ccnt_backward:undefined,
		//m_mergable_ccnt_forward:undefined,
		m_current_merged_item:0,
		m_y_extent_backward:0,
		m_y_extent_forward:0,
	};
	if(flags&UI.SEARCH_FLAG_GLOBAL){
		var spath_repo=UI.GetEditorProject(doc.m_file_name);
		ctx.m_repo_path=spath_repo;
		ctx.m_base_file=doc.m_file_name;
		ctx.m_result_cell=UI.OpenNotebookCellFromEditor(doc,"Search result","Markdown",1)
		if(ctx.m_result_cell){
			ctx.m_result_cell.obj_notebook.ClearCellOutput(ctx.m_result_cell.cell_id)
		}
	}else{
		ctx.m_sel0_before_find=doc.sel0.ccnt;
		ctx.m_sel1_before_find=doc.sel1.ccnt;
	}
	ctx.__proto__=find_context_prototype;
	var y_id=doc.ed.XYFromCcnt(ccnt1).y
	var y_id0=Math.max(y_id-hc*ctx.m_context_size,0),y_id1=Math.min(y_id+hc*(ctx.m_context_size+1),ytot)
	//id, virtual_screen_y, scroll_y, h
	//the middle segment is duplicated for convenience
	ctx.m_merged_y_windows_backward.push(0,-hc*ctx.m_context_size,y_id0,y_id1-y_id0);
	ctx.m_merged_y_windows_forward.push(0,-hc*ctx.m_context_size,y_id0,y_id1-y_id0);
	//ctx.m_mergable_ccnt_backward=doc.ed.SeekXY(0,y_id)
	//ctx.m_mergable_ccnt_forward=doc.ed.SeekXY(1e17,y_id)
	ctx.m_y_extent_backward=-hc*ctx.m_context_size;
	ctx.m_y_extent_forward=hc*(ctx.m_context_size+1);
	//if(flags&UI.SEARCH_FLAG_GLOBAL){
	//	UI.g_is_in_global_search++;
	//}
	return ctx;
}

var CheckEditorExternalChange=function(obj){
	if(obj.doc.m_loaded_time!=IO.GetFileTimestamp(obj.file_name)){
		if(obj.doc.ed.saving_context){return;}//saving docs are OK
		//reload
		if(!IO.FileExists(obj.file_name)){
			//make a notification
			obj.CreateNotification({id:'saving_progress',icon:'警',text:"IT'S DELETED!\nSave your changes to dismiss this"})
			obj.doc.saved_point=-1;
		}else if(obj.doc.NeedSave()){
			//make a notification
			obj.CreateNotification({id:'saving_progress',icon:'警',text:"FILE CHANGED OUTSIDE!\n - Use File-Revert to reload\n - Save your changes to dismiss this"})
			obj.doc.saved_point=-1;
		}else{
			//what is reload? nuke it
			obj.Reload()
		}
	}
};

W.CodeEditorWidget_prototype={
	m_tabswitch_count:{},
	OnDestroy:function(){
		this.DestroyFindingContext()
		if(this.doc){
			UI.CloseCodeEditorDocument(this.doc)
			this.doc=undefined;
		}
	},
	///////////////////////////
	Reload:function(){
		this.SaveMetaData()
		this.DestroyFindingContext()
		this.m_ac_context=undefined
		if(this.doc){
			UI.CloseCodeEditorDocument(this.doc);
		}
		this.doc=undefined
		this.m_notifications=[]
		UI.Refresh()
	},
	///////////////////////////
	SaveMetaData:function(is_forced){
		var doc=this.doc
		if(this.m_is_preview||doc&&doc.ed.hfile_loading&&!is_forced){return;}
		if(!doc||doc.notebook_owner||!IO.FileExists(this.file_name)&&!(this.file_name.length&&this.file_name[0]=='*')){return;}
		var new_metadata=(UI.m_ui_metadata[this.file_name]||{});
		new_metadata.m_tabswitch_count=this.m_tabswitch_count;
		new_metadata.m_bookmarks=[];
		new_metadata.m_unkeyed_bookmarks=[];
		new_metadata.sel0=doc.sel0.ccnt;
		new_metadata.sel1=doc.sel1.ccnt;
		for(var i=0;i<UI.m_code_editor_persistent_members_doc.length;i++){
			var name_i=UI.m_code_editor_persistent_members_doc[i]
			new_metadata[name_i]=this.doc[name_i]
		}
		for(var i=0;i<10;i++){
			var bm=doc.m_bookmarks[i]
			new_metadata.m_bookmarks[i]=(bm?bm.ccnt:'n/a')
		}
		for(var i=0;i<doc.m_unkeyed_bookmarks.length;i++){
			var bm=doc.m_unkeyed_bookmarks[i]
			if(bm){
				new_metadata.m_unkeyed_bookmarks.push(bm.ccnt)
			}
		}
		var renderer=doc.GetRenderer();
		new_metadata.m_hidden_ranges=renderer.GetHiddenRanges();
		UI.m_ui_metadata[this.file_name]=new_metadata
	},
	OnSave:function(){
		this.doc.ed.m_file_index=undefined;
		this.SaveMetaData();
		UI.SaveMetaData();
		this.doc.CallHooks("save")
		if(this.doc.plugin_language_desc!=UI.ED_GetFileLanguage(this.doc.m_file_name)){
			this.Reload()
		}else{
			this.doc.ParseFile()
		}
		////////////
		if(this.doc&&this.doc.m_file_name){
			var arr_ori=UI.g_editor_from_file[this.doc.m_file_name];
			if(arr_ori&&arr_ori.length>1){
				for(var i=0;i<arr_ori.length;i++){
					var doc=arr_ori[i];
					if(doc!=this.doc&&doc.owner){
						CheckEditorExternalChange(doc.owner);
					}
				}
			}
		}
	},
	Save:function(){
		var fn=this.file_name;
		var doc=this.doc
		if(doc.ed.hfile_loading){
			this.CreateNotification({id:'saving_progress',icon:'错',text:"You cannot save a file before it finishes loading"})
			return
		}
		if(fn.length&&fn[0]=='*'){
			var fn_special=fn.substr(1);
			var fsaver=(UI.m_special_files[fn_special]&&UI.m_special_files[fn_special].Save);
			if(fsaver){
				fsaver(this.doc.ed.GetText());
				doc.saved_point=doc.ed.GetUndoQueueLength()
				doc.ResetSaveDiff()
			}
			return;
		}
		//use cased file name on Windows...
		var ctx=UI.EDSaver_Open(doc.ed,IO.NormalizeFileName(this.file_name,1))
		if(!ctx){
			this.CreateNotification({id:'saving_progress',icon:'错',text:"Cannot create a temporary file for saving"})
			return
		}
		doc.ed.saving_context=ctx
		this.AcquireEditLock();
		fsave_code_editor.call(this)
	},
	///////////////////////////////////////////
	m_edit_lock:0,
	AcquireEditLock:function(){
		this.m_edit_lock++
	},
	ReleaseEditLock:function(){
		if(this.m_edit_lock>0){this.m_edit_lock--;}
		UI.RefreshAllTabs()
	},
	////////////////////////////////////
	//the virtual document doesn't include middle expansion
	//middle-expand with fixed additional size to make it possible
	DestroyFindingContext:function(){
		if(this.m_current_find_context){
			this.m_current_find_context.Cancel()
			this.m_current_find_context=undefined
		}
	},
	ResetFindingContext:function(sneedle,flags, force_ccnt){
		var doc=this.doc
		var ccnt=(force_ccnt==undefined?doc.sel1.ccnt:force_ccnt)
		this.m_hide_find_highlight=0
		if(this.m_current_find_context){
			if(force_ccnt!=undefined&&
			force_ccnt==this.m_current_find_context.m_starting_ccnt0&&
			!this.m_changed_after_find&&
			sneedle==this.m_current_find_context.m_needle&&
			!(this.m_current_find_context.m_flags&UI.SEARCH_FLAG_FUZZY)){
				return;
			}
		}
		if(!sneedle.length&&!(flags&UI.SEARCH_FLAG_GOTO_MODE)){
			//this.m_current_needle=undefined
			UI.m_ui_metadata["<find_state>"].m_current_needle=""
			return;
		}
		if(!(flags&UI.SEARCH_FLAG_GOTO_MODE)){
			UI.m_ui_metadata["<find_state>"].m_current_needle=sneedle
		}
		var renderer=doc.GetRenderer()
		var bk_m_enable_hidden=renderer.m_enable_hidden;
		renderer.m_enable_hidden=((flags&UI.SEARCH_FLAG_HIDDEN)?0:1);
		if(flags&UI.SEARCH_FLAG_GLOBAL){
			ccnt=0;
			force_ccnt=0;
		}
		var ctx=CreateFindContext(this,doc,sneedle,flags,force_ccnt==undefined?doc.sel0.ccnt:ccnt,force_ccnt==undefined?doc.sel1.ccnt:ccnt)
		ctx.SetRenderingHeight(this.h-this.h_find_bar);
		if((flags&UI.SEARCH_FLAG_GLOBAL)&&this.m_current_find_context&&this.m_current_find_context.m_temp_documents){
			//carry over docs to avoid re-loading
			//keep at most one refs for each doc
			var temp_docs0=this.m_current_find_context.m_temp_documents;
			ctx.m_temp_documents=[];
			for(var i=0;i<temp_docs0.length;i++){
				if(temp_docs0[i].m_ed_refcnt>1){
					UI.CloseCodeEditorDocument(temp_docs0[i])
				}else{
					ctx.m_temp_documents.push(temp_docs0[i]);
				}
			}
			this.m_current_find_context.m_temp_documents=undefined;
		}
		this.DestroyFindingContext()
		this.m_current_find_context=ctx
		if(force_ccnt==undefined){
			ctx.UpdateFindItemSelection();
			//UI.InvalidateCurrentFrame();
			UI.Refresh()
		}
		if((flags&UI.SEARCH_FLAG_GOTO_MODE)&&!(flags&UI.SEARCH_FLAG_GLOBAL)){
			//ignore the flags
			var matches=[]
			//try to go to line number first
			var line_id=parseInt(sneedle)
			ctx.m_goto_line_error=undefined;
			if(line_id>0){
				var line_id_eval=line_id;
				var err=undefined;
				try{
					line_id_eval=JSON.parse(Duktape.__eval_expr_sandbox(sneedle))
				}catch(e){
					err=e.message;
					line_id_eval=undefined;
				}
				if(typeof line_id_eval=='number'){
					line_id=Math.floor(line_id_eval);
				}else{
					ctx.m_goto_line_error=err;
				}
				ctx.m_goto_line_number=line_id;
				var line_ccnts=doc.SeekAllLinesBetween(line_id-1,line_id+1)
				if(line_ccnts[0]<line_ccnts[1]){
					var line_ccnt0=doc.ed.MoveToBoundary(line_ccnts[0],1,"space");
					var line_ccnt1=line_ccnts[1]-1
					if(!(line_ccnt1>line_ccnt0)){line_ccnt1=line_ccnt0;}
					matches.push(line_ccnt0,line_ccnt1)
				}
			}else{
				//search for function / class
				//coulddo: make it progressive - search callback, faster is-unmodified test
				matches=(UI.ED_QueryKeyDeclByNeedle(doc,sneedle)||[]);
			}
			SetFindContextFinalResult(ctx,ccnt,matches)
			UI.Refresh()
		}
		renderer.m_enable_hidden=bk_m_enable_hidden
	},
	BeforeQuickFind:function(direction){
		if(!this.doc){return;}
		var sel=this.doc.GetSelection()
		//this.show_find_bar=1
		//this.m_sel0_before_find=this.doc.sel0.ccnt
		//this.m_sel1_before_find=this.doc.sel1.ccnt
		if(!(sel[0]<sel[1])){
			var ccnt=this.doc.sel1.ccnt
			var ed=this.doc.ed
			var neib=ed.GetUtf8CharNeighborhood(ccnt);
			if(UI.ED_isWordChar(neib[0])||UI.ED_isWordChar(neib[1])){
				sel[0]=this.doc.SkipInvisibles(ccnt,-1);
				sel[0]=this.doc.SnapToValidLocation(ed.MoveToBoundary(ed.SnapToCharBoundary(sel[0],-1),-1,"word_boundary_left"),-1)
				////print('SkipInvisibles',sel[0],ccnt)
				//sel[0]=ed.SnapToCharBoundary(sel[0],-1);
				////print('SnapToCharBoundary',sel[0],ccnt)
				//sel[0]=ed.MoveToBoundary(sel[0],-1,"word_boundary_left");
				////print('word_boundary_left',sel[0],ccnt)
				//sel[0]=this.doc.SnapToValidLocation(sel[0],-1);
				////print('SnapToValidLocation',sel[0],ccnt)
				sel[1]=this.doc.SkipInvisibles(ccnt,1);
				sel[1]=this.doc.SnapToValidLocation(ed.MoveToBoundary(ed.SnapToCharBoundary(sel[1],1),1,"word_boundary_right"),1)
			}
		}
		if(sel[0]<sel[1]){
			this.DestroyFindingContext()
			UI.m_ui_metadata["<find_state>"].m_current_needle=this.doc.ed.GetText(sel[0],sel[1]-sel[0])
			if(UI.m_ui_metadata["<find_state>"].m_find_flags&UI.SEARCH_FLAG_REGEXP){
				UI.m_ui_metadata["<find_state>"].m_current_needle=RegexpEscape(UI.m_ui_metadata["<find_state>"].m_current_needle)
			}
			return 1;
		}
		return 0;
	},
	///////////////////////////////////
	SetReplacingContext:function(ccnt0,ccnt1){
		this.DestroyReplacingContext();
		var ctx=this.m_current_find_context
		var doc=this.doc
		var ed=doc.ed
		var rctx={
			m_needle:ctx.m_needle,
			m_flags:ctx.m_flags,
			m_locators:[ed.CreateLocator(ccnt0,-1),ed.CreateLocator(ccnt1,1)],
		}
		rctx.m_locators[0].undo_tracked=1
		rctx.m_locators[1].undo_tracked=1
		var hlobj=doc.ed.CreateHighlight(rctx.m_locators[0],rctx.m_locators[1],-1)
		//hlobj.color=this.find_item_replace_highlight_color;
		hlobj.invertible=0;
		hlobj.display_mode=UI.HL_DISPLAY_MODE_RECTEX;
		hlobj.depth=1
		rctx.m_highlight=hlobj;
		doc.m_hide_prev_next_buttons=0;
		this.m_replace_context=rctx;
	},
	DestroyReplacingContext:function(do_dismiss){
		if(do_dismiss==undefined){do_dismiss=1;}
		var rctx=this.m_replace_context
		if(rctx){
			rctx.m_locators[0].discard()
			rctx.m_locators[1].discard()
			rctx.m_highlight.discard()
			this.m_replace_context=undefined
			if(do_dismiss){this.DismissNotification('find_result')}
		}
	},
	DoReplace:function(ccnt0,ccnt1,is_first,s_replace){
		var doc=this.doc
		var rctx=this.m_replace_context
		if(!rctx){return;}
		this.AcquireEditLock();
		rctx.m_ccnt0=ccnt0
		rctx.m_ccnt1=ccnt1
		rctx.m_frontier=(is_first<0?ccnt1:ccnt0)
		rctx.m_match_cost=(is_first?1048576:64)
		rctx.m_s_replace=s_replace
		rctx.m_owner=this
		var ffind_next=function(){
			//print("replace: ffind_next ",rctx.m_frontier)
			rctx.m_frontier=UI.ED_Search(doc.ed,rctx.m_frontier,is_first||1,rctx.m_needle,rctx.m_flags,1048576, undefined,rctx)
			//print("search finished ",s_replace)
			var ccnt_frontier=UI.GetSearchFrontierCcnt(rctx.m_frontier)
			if(ccnt_frontier<0||(is_first<0?(ccnt_frontier<rctx.m_ccnt0):(ccnt_frontier>=rctx.m_ccnt1))||rctx.m_current_replace_job&&is_first){
				var need_onchange=0
				rctx.m_owner.ReleaseEditLock();
				if(rctx.m_current_replace_job){
					var n_replaced=UI.ED_ApplyReplaceOps(doc.ed,rctx.m_current_replace_job)
					if(n_replaced){
						need_onchange=1
						rctx.m_owner.CreateNotification({id:'find_result',icon:'对',text:UI._("Replaced @1 matches").replace("@1",n_replaced.toString())})
					}else{
						var direction=(is_first||1)
						rctx.m_owner.CreateNotification({id:'find_result',icon:'警',text:(direction<0?UI._("Nothing replaced above"):UI._("Nothing replaced below"))})
					}
				}
				if(!is_first){
					rctx.m_owner.DestroyReplacingContext(0);
				}else{
					if(rctx.m_current_replace_job){
						var sel_new=rctx.m_current_replace_job.GetLastMatch()
						if(sel_new){
							if(is_first<0){
								doc.SetSelection(sel_new[1],sel_new[0])
							}else{
								doc.SetSelection(sel_new[0],sel_new[1])
							}
						}
					}
					rctx.m_current_replace_job=undefined
				}
				if(need_onchange){doc.CallOnChange();}
				UI.SetFocus(doc);
			}else{
				UI.NextTick(ffind_next);
			}
		}
		ffind_next();
	},
	DoReplaceFromUI:function(is_first){
		var doc=this.doc
		var rctx=this.m_replace_context
		if(!rctx){return;}
		var srep_ccnt0=rctx.m_locators[0].ccnt
		var srep_ccnt1=rctx.m_locators[1].ccnt
		var sel=doc.GetSelection()
		var ccnt0,ccnt1;
		if(sel[0]<sel[1]&&!is_first){
			ccnt0=sel[0]
			ccnt1=sel[1]
		}else{
			if(is_first<0){
				ccnt0=0
				ccnt1=sel[0]
				//avoid self-replacing
				if(ccnt1>srep_ccnt0&&ccnt1<=srep_ccnt1){
					ccnt1=srep_ccnt0;
				}
			}else{
				ccnt0=sel[1]
				ccnt1=doc.ed.GetTextSize()
				//avoid self-replacing
				if(ccnt0>=srep_ccnt0&&ccnt0<srep_ccnt1){
					ccnt0=srep_ccnt1;
				}
			}
		}
		if(srep_ccnt0<srep_ccnt1){
			s_replace=doc.ed.GetText(srep_ccnt0,srep_ccnt1-srep_ccnt0)
		}else{
			s_replace='';
		}
		this.DoReplace(ccnt0,ccnt1,is_first,s_replace)
	},
	///////////////////////////////////
	BringUpNotification:function(item){
		var ns=this.m_notifications
		for(var i=0;i<ns.length;i++){
			var nsi=ns[i]
			if(nsi==item){
				for(var j=i-1;j>=0;j--){
					ns[j+1]=ns[j]
				}
				ns[0]=item
				//if(!i){
				//item.x_shake=this.x_shake_notification
				if(this.notification_list&&this.notification_list[item.id]){
					this.notification_list[item.id].dx_shake=this.dx_shake_notification
				}
				//}
				if(this.m_owner){
					this.m_owner.m_is_rendering_good=0;
				}
				return
			}
		}
	},
	CreateNotification:function(attrs,is_quiet){
		attrs.text=UI._(attrs.text);
		var ns=this.m_notifications
		if(!ns){
			ns=[]
			this.m_notifications=ns
		}
		for(var i=0;i<ns.length;i++){
			var nsi=ns[i]
			//(nsi.text==attrs.text&&(nsi.color==attrs.color||!attrs.color)){
			if(nsi.id==attrs.id){
				//bring it up and shake it - y-animated list?
				for(var key in attrs){
					nsi[key]=attrs[key]
				}
				if(!is_quiet){this.BringUpNotification(nsi)}
				return nsi;
			}
		}
		attrs.alpha=1
		//if(!is_quiet){attrs.dx_shake=this.dx_shake_notification}
		ns=[attrs].concat(ns);
		this.m_notifications=ns;
		if(this.m_owner){
			this.m_owner.m_is_rendering_good=0;
		}
		UI.Refresh()
		return attrs;
	},
	DismissNotification:function(id){
		if(this.m_notifications){
			var n0=this.m_notifications.length;
			this.m_notifications=this.m_notifications.filter(function(a){return a.id!=id})
			if(n0!=this.m_notifications.length){
				if(this.m_owner){
					this.m_owner.m_is_rendering_good=0;
				}
			}
		}
	},
	DismissNotificationsByRegexp:function(re){
		if(this.m_notifications){
			var n0=this.m_notifications.length;
			this.m_notifications=this.m_notifications.filter(function(a){return !(a.id.search(re)>=0)})
			if(n0!=this.m_notifications.length){
				if(this.m_owner){
					this.m_owner.m_is_rendering_good=0;
				}
			}
		}
	},
	////////////////////
	FindNext:function(direction,custom_needle,custom_flags){
		UI.assert(!this.m_find_next_context,"panic: FindNext when there is another context")
		if(!custom_needle&&!UI.m_ui_metadata["<find_state>"].m_current_needle){
			//no needle, no find
			return;
		}
		this.m_hide_find_highlight=0
		this.m_no_more_replace=0;
		this.DestroyReplacingContext(1)
		var doc=this.doc
		var ccnt=custom_needle?0:doc.sel1.ccnt
		var ctx={
			m_frontier:ccnt,
			m_owner:this,
			m_needle:custom_needle||UI.m_ui_metadata["<find_state>"].m_current_needle,
			m_flags:custom_flags==undefined?UI.m_ui_metadata["<find_state>"].m_find_flags:custom_flags,
			m_match_reported:0,
			ReportMatch:function(ccnt0,ccnt1){
				if(direction>0){
					//doc.sel0.ccnt=ccnt0
					//doc.sel1.ccnt=ccnt1
					doc.SetSelection(ccnt0,ccnt1)
				}else{
					//doc.sel0.ccnt=ccnt1
					//doc.sel1.ccnt=ccnt0
					doc.SetSelection(ccnt1,ccnt0)
				}
				this.m_match_reported=1
				doc.AutoScroll("center_if_hidden")
				doc.CallOnSelectionChange();
				UI.Refresh()
				return 1048576
			},
			ffind_next:function(){
				this.m_frontier=UI.ED_Search(doc.ed,this.m_frontier,direction,this.m_needle,this.m_flags,1048576,this.ReportMatch.bind(this),this)
				if(UI.IsSearchFrontierCompleted(this.m_frontier)||this.m_match_reported){
					UI.assert(this.m_owner.m_find_next_context==this,"panic: FindNext context overwritten")
					this.m_owner.ReleaseEditLock();
					this.m_owner.m_find_next_context=undefined
					UI.SetFocus(doc);
					if(!this.m_match_reported){
						//notification
						this.m_owner.CreateNotification({id:'find_result',icon:'警',text:UI._(direction<0?"No more '@1' above":"No more '@1' below").replace("@1",this.m_needle)})
					}
					UI.Refresh()
				}else{
					UI.NextTick(this.ffind_next.bind(this));
				}
			}
		}
		this.AcquireEditLock();
		this.m_find_next_context=ctx;
		ctx.ffind_next();
	},
	OpenAsDefinition:function(fn,ccnt_go,is_peek,new_def_context){
		var doc=this.doc;
		var ed=doc.ed;
		var ccnt_sel1=doc.sel1.ccnt;
		var ccnt_nextline=doc.SeekLC(doc.GetLC(ccnt_sel1)[0]+1,0);
		if(is_peek){
			if(ed.GetUtf8CharNeighborhood(ccnt_nextline)[0]==10){
				//actually open a readonly doc here - should be a copy of the actual file
				//and we should support reopening
				//a widget with Reload calls
				var hc=doc.ed.GetCharacterHeightAt(0);
				var renderer=doc.GetRenderer();
				var doc_new=undefined;
				if(fn&&fn!=doc.m_file_name){
					//read that file, it's a peek, we are assuming a small file
					doc_new=UI.OpenCodeEditorDocument(fn);
					doc_new.m_is_preview=0;
					doc_new.Init();
				}else{
					//copy the current document
					fn=doc.m_file_name;
					doc_new=UI.CreateEmptyCodeEditor(doc.m_language_id)
					doc_new.Init();
					doc_new.ed.Edit([0,0,doc.ed.GetText()],1)
					doc_new.ed.m_file_index=doc.ed.m_file_index;
				}
				doc_new.read_only=1;
				doc_new.AddEventHandler('ESC',function(){
					renderer.RemoveAllEmbeddedObjects();
					Duktape.gc();
					UI.Refresh();
				})
				//if(ccnt_go!=undefined){
				//	doc_new.SetSelection(ccnt_go,ccnt_go);
				//}
				renderer.RemoveAllEmbeddedObjects();
				renderer.EmbedObject(ed,ccnt_nextline-1,{
					h:this.peekdef_h,hc:hc,doc:doc_new,
					id_doc:"peek_"+Date.now(),
					has_ccnt_set:0,
					ccnt_go:ccnt_go,
					host:this,
					ccnt_host_embed:ccnt_sel1,
					fn:fn,
					Render:function(x,y,scale){
						//UI.RoundRect({
						//	x:x,y:y,
						//	w:this.w,h:this.h*this.hc,
						//	color:0xff0000ff,
						//})
						//console.log(this.id_doc,UI.m_frame_tick)
						this.w=this.host.doc.w-0.5*(x-this.host.x);
						var obj_peek=W.CodeEditor(this.id_doc,{
							is_definition_peek:1,
							m_ceo_host:this,
							disable_minimap:1,
							disable_top_hint:1,
							doc:this.doc,
							read_only:1,
							x:x,y:y,w:this.w,h:this.h*this.hc,
						});
						var fn_display=UI.GetSmartTabName(this.fn);
						var edstyle=UI.default_styles.code_editor;
						var text_dim=UI.MeasureText(edstyle.find_message_font,fn_display)
						UI.RoundRect({
							x:(obj_peek.x+obj_peek.w-32-text_dim.w),y:y+4,
							w:text_dim.w,h:text_dim.h,
							round:2,
							color:edstyle.bgcolor&0xaaffffff,
						})
						W.Text("",{
							x:(obj_peek.x+obj_peek.w-32-text_dim.w),y:y+4,
							font:edstyle.find_message_font,color:edstyle.editor_style.color_symbol,
							text:fn_display})
						//obj_peek
						if(this.has_ccnt_set==1){
							//this.doc.h_top_hint=this.doc.h_top_hint_real;
							this.doc.AutoScroll("show");
							this.has_ccnt_set=2;
						}
						if(!this.has_ccnt_set){
							//console.log(this.ccnt_go,this.doc.ed.GetTextSize());
							if(this.ccnt_go!=undefined&&this.doc.ed&&this.ccnt_go<this.doc.ed.GetTextSize()){
								this.has_ccnt_set=1;
								this.doc.SetSelection(this.ccnt_go,this.ccnt_go);
								this.doc.scroll_y=this.doc.ed.XYFromCcnt(this.ccnt_go).y;
								//this.doc.h_top_hint=this.doc.h_top_hint_real;
								this.doc.AutoScroll("show");
							}
						}
					},
					OnDestroy:function(){
						if(this.doc.m_file_name){
							RemoveDocFromByFileList(this.doc,this.doc.m_file_name);
						}
					},
				});
				Duktape.gc();
				if(new_def_context){
					UI.g_goto_definition_context=new_def_context;
				}
				UI.Refresh();
			}
		}else{
			UI.RecordCursorHistroy(doc,"go_to_definition")
			if(!fn){
				this.doc.SetSelection(ccnt_go,ccnt_go);
			}else{
				UI.OpenEditorWindow(fn,ccnt_go!=undefined&&function(){
					var doc=this;
					var ccnt=ccnt_go;
					if(doc.m_diff_from_save){
						ccnt=doc.m_diff_from_save.BaseToCurrent(ccnt)
					}
					doc.SetSelection(ccnt,ccnt)
					if(new_def_context){
						UI.g_goto_definition_context=new_def_context;
					}
					UI.g_cursor_history_test_same_reason=1
					UI.Refresh()
				});
				if(new_def_context){
					this.DestroyReplacingContext(1)
				}
			}
		}
	},
	GotoDefinitionByID:function(is_peek,id){
		var doc=this.doc;
		var ed=doc.ed
		var ccnt0=doc.sel1.ccnt
		var ccnt=ccnt0
		for(;;){
			//parser-friendly outer scope search
			var fol_ret=doc.FindOuterLevel(ccnt);
			ccnt=fol_ret.ccnt_editor;
			ccnt_query=fol_ret.ccnt_parser;
			if(!(ccnt>=0)){ccnt=0;}
			if(doc.m_diff_from_save){
				ccnt_query=doc.m_diff_from_save.CurrentToBase(ccnt_query)
			}
			var ccnt_decl=UI.ED_QueryDecl(doc,ccnt_query,id)
			if(ccnt_decl>=0){
				if(doc.m_diff_from_save){
					ccnt_decl=doc.m_diff_from_save.BaseToCurrent(ccnt_decl)
				}
				if(ccnt_decl!=ccnt0){
					//UI.SetSelectionEx(doc,ccnt_decl,ccnt_decl,"go_to_definition")
					this.OpenAsDefinition(undefined,ccnt_decl,is_peek);
					UI.Refresh()
					return;
				}
			}
			if(!(ccnt>0)){break;}
		}
		var gkds=UI.ED_QueryKeyDeclByID(id)
		//not found, check key decls by id
		var fn=doc.owner.file_name
		var p_target=0
		ccnt=ccnt0
		if(doc.m_diff_from_save){
			ccnt=doc.m_diff_from_save.CurrentToBase(ccnt)
		}
		for(var i=0;i<gkds.length;i+=2){
			if(fn==gkds[i+0]&&ccnt==gkds[i+1]){
				p_target=i+2
				if(p_target>=gkds.length){
					p_target=0;
				}
				break
			}
		}
		if(p_target<gkds.length){
			this.OpenAsDefinition(gkds[p_target+0],gkds[p_target+1],is_peek,gkds.length>2&&{gkds:gkds,p_target:p_target});
		}else{
			this.CreateNotification({id:'find_result',icon:'警',text:UI._("Cannot find a definition of '@1'").replace("@1",id)})
		}
	},
	GotoDefinition:function(is_peek){
		var doc=this.doc;
		var sel=doc.GetSelection();
		var ed=doc.ed
		var ccnt_sel1=doc.sel1.ccnt
		if(doc.m_diff_from_save){ccnt_sel1=doc.m_diff_from_save.CurrentToBase(ccnt_sel1)}
		var s_dep_file=UI.ED_QueryDepTokenByBaseCcnt(doc,ccnt_sel1)
		if(s_dep_file){
			//UI.OpenEditorWindow(s_dep_file)
			this.OpenAsDefinition(s_dep_file,undefined,is_peek);
			return
		}
		sel[0]=ed.MoveToBoundary(sel[0],-1,"word_boundary_left")
		sel[1]=ed.MoveToBoundary(sel[1],1,"word_boundary_right")
		if(sel[0]<sel[1]){
			var id=ed.GetText(sel[0],sel[1]-sel[0])
			if(this.is_definition_peek&&!is_peek){
				var obj_host=this.m_ceo_host.host;
				if(obj_host.doc){
					obj_host.doc.SetSelection(this.m_ceo_host.ccnt_host_embed,this.m_ceo_host.ccnt_host_embed);
					obj_host.GotoDefinitionByID(1,id);
					return;
				}
			}
			this.GotoDefinitionByID(is_peek,id);
		}
	}
}

var ffindbar_plugin=function(){
	this.AddEventHandler('ESC',function(){
		var obj=this.find_bar_owner
		var ctx=obj.m_current_find_context
		if(ctx){
			ctx.CancelFind();
		}else{
			obj.show_find_bar=0;
			UI.Refresh();
		}
	})
	this.AddEventHandler('RETURN RETURN2',function(){
		var obj=this.find_bar_owner
		var ctx=obj.m_current_find_context
		if(ctx){
			ctx.ConfirmFind();
		}
		obj.show_find_bar=0;
		obj.doc.AutoScroll('center')
		obj.doc.scrolling_animation=undefined
		UI.Refresh()
	})
	this.AddEventHandler('change',function(){
		var obj=this.find_bar_owner
		//obj.doc.sel0.ccnt=obj.m_sel0_before_find
		//obj.doc.sel1.ccnt=obj.m_sel1_before_find
		var ctx=obj.m_current_find_context
		if(ctx){
			ctx.RestoreSel();
		}
		obj.DestroyReplacingContext();
		var find_flag_mode=(obj.show_find_bar&~UI.SEARCH_FLAG_SHOW)
		obj.ResetFindingContext(this.ed.GetText(),UI.m_ui_metadata["<find_state>"].m_find_flags|find_flag_mode)
	})
	//skip zero
	this.AddEventHandler('UP',function(){
		var obj=this.find_bar_owner
		if(obj.m_current_find_context){
			var ctx=obj.m_current_find_context
			ctx.m_home_end=undefined;
			if(ctx.m_current_point>-((ctx.m_backward_matches.length/3))&&!(ctx.m_current_point==1&&(ctx.m_flags&UI.SEARCH_FLAG_GLOBAL))){
				ctx.m_current_point--;
				if(!ctx.m_current_point&&ctx.m_current_point>-((ctx.m_backward_matches.length/3))){
					ctx.m_current_point--;
				}
				ctx.AutoScrollFindItems()
				UI.Refresh()
			}
		}
	})
	this.AddEventHandler('DOWN',function(){
		var obj=this.find_bar_owner
		if(obj.m_current_find_context){
			var ctx=obj.m_current_find_context
			ctx.m_home_end=undefined;
			if(ctx.m_current_point<(ctx.m_forward_matches.length/3)){
				ctx.m_current_point++
				if(!ctx.m_current_point&&ctx.m_current_point<(ctx.m_forward_matches.length/3)){
					ctx.m_current_point++;
				}
				ctx.AutoScrollFindItems()
				UI.Refresh()
			}
		}
	})
	//////////////////////////////////////////////////
	this.AddEventHandler('PGUP',function(){
		var obj=this.find_bar_owner
		if(obj.m_current_find_context){
			var ctx=obj.m_current_find_context
			ctx.m_find_scroll_visual_y-=ctx.m_current_visual_h
			ctx.SeekFindItemByVisualY(ctx.m_current_visual_y-ctx.m_current_visual_h,1e17)
			if(!ctx.m_current_point&&ctx.m_current_point>-((ctx.m_backward_matches.length/3))){
				ctx.m_current_point--;
			}
			ctx.m_home_end=undefined;
			ctx.AutoScrollFindItems()
			UI.Refresh()
		}
	})
	this.AddEventHandler('PGDN',function(){
		var obj=this.find_bar_owner
		if(obj.m_current_find_context){
			var ctx=obj.m_current_find_context
			ctx.m_find_scroll_visual_y+=ctx.m_current_visual_h
			ctx.SeekFindItemByVisualY(ctx.m_current_visual_y+ctx.m_current_visual_h,0)
			if(!ctx.m_current_point&&ctx.m_current_point<(ctx.m_forward_matches.length/3)){
				ctx.m_current_point++;
			}
			ctx.m_home_end=undefined;
			ctx.AutoScrollFindItems()
			UI.Refresh()
		}
	})
	this.AddEventHandler('CTRL+HOME',function(){
		var obj=this.find_bar_owner
		if(obj.m_current_find_context){
			var ctx=obj.m_current_find_context
			ctx.SeekFindItemByVisualY(ctx.m_y_extent_backward,0)
			ctx.m_home_end='home';
			ctx.AutoScrollFindItems()
			UI.Refresh()
		}
	})
	this.AddEventHandler('CTRL+END',function(){
		var obj=this.find_bar_owner
		if(obj.m_current_find_context){
			var ctx=obj.m_current_find_context
			ctx.SeekFindItemByVisualY(ctx.m_y_extent_forward,1e17)
			ctx.m_home_end='end';
			ctx.AutoScrollFindItems()
			UI.Refresh()
		}
	})
	this.AddEventHandler('CTRL+F',function(){
		var obj=this.find_bar_owner;
		obj.show_find_bar=UI.SHOW_FIND;
		this.CallOnChange();
		UI.Refresh()
	})
	this.AddEventHandler('CTRL+G',function(){
		var obj=this.find_bar_owner;
		obj.show_find_bar=UI.SHOW_GOTO;
		this.CallOnChange();
		UI.Refresh()
	})
	this.AddEventHandler('SHIFT+CTRL+F',function(){
		var obj=this.find_bar_owner;
		obj.show_find_bar=UI.SHOW_GLOBAL_FIND;
		this.CallOnChange();
		UI.Refresh()
	})
	this.AddEventHandler('SHIFT+CTRL+G',function(){
		var obj=this.find_bar_owner;
		obj.show_find_bar=UI.SHOW_GLOBAL_GOTO;
		this.CallOnChange();
		UI.Refresh()
	})
	this.OnMouseWheel=function(event){
		var obj=this.find_bar_owner;
		var hc=UI.GetCharacterHeight(obj.editor_style.font)
		var dy=-hc*event.y*this.mouse_wheel_speed;
		if(!dy){return;}
		if(obj.m_current_find_context){
			var ctx=obj.m_current_find_context
			var point0=ctx.m_current_point;
			ctx.m_find_scroll_visual_y+=dy;
			//ctx.SeekFindItemByVisualY(ctx.m_current_visual_y+dy,0)
			//if(dy<0){
			//	if(point0==ctx.m_current_point&&ctx.m_current_point>-((ctx.m_backward_matches.length/3))){
			//		ctx.m_current_point--;
			//	}
			//	if(!ctx.m_current_point&&ctx.m_current_point>-((ctx.m_backward_matches.length/3))){
			//		ctx.m_current_point--;
			//	}
			//}else{
			//	if(point0==ctx.m_current_point&&ctx.m_current_point<(ctx.m_forward_matches.length/3)){
			//		ctx.m_current_point++;
			//	}
			//	if(!ctx.m_current_point&&ctx.m_current_point<(ctx.m_forward_matches.length/3)){
			//		ctx.m_current_point++;
			//	}
			//}
			ctx.m_home_end=undefined;
			ctx.ValidateFindItemScroll()
			UI.Refresh()
		}
	}
}

var g_repo_from_file={}
var g_repo_list={}
//we only put not-yet-run parsing functions in there
var g_repo_parsing_context={queue:[]};
var ResumeProjectParsing=function(g_repo_parsing_context){
	if(g_repo_parsing_context.canceled){return;}
	if(g_repo_parsing_context.queue.length){
		g_repo_parsing_context.is_parsing=1;
		(g_repo_parsing_context.queue.shift())();
	}else{
		g_repo_parsing_context.is_parsing=0;
	}
	UI.RefreshAllTabs();
};
var QueueProjectParser=function(f){
	if(g_repo_parsing_context.is_parsing){
		g_repo_parsing_context.queue.push(f);
	}else{
		g_repo_parsing_context.is_parsing=1;
		f();
	}
};
var ParseGit=function(spath){
	if(g_repo_list[spath]){return;}
	var my_repo={name:spath,is_parsing:1,files:[]}
	g_repo_list[spath]=my_repo;
	QueueProjectParser(function(){
		IO.RunTool(["git","ls-files"],spath, ".*",function(g_repo_from_file,match){
			if(match[0].indexOf(':')>=0){
				return;
			}
			var fname=IO.NormalizeFileName(spath+"/"+match[0])
			if(UI.Platform.ARCH=="win32"||UI.Platform.ARCH=="win64"){
				fname=fname.toLowerCase()
			}
			var repos=g_repo_from_file[fname]
			if(!repos){
				repos={};
				g_repo_from_file[fname]=repos
			}
			//repo -> status map
			repos[spath]="  ";
			my_repo.files.push(fname)
		}.bind(undefined,g_repo_from_file),function(){
			//some dangling dependencies may have been resolved
			//"git status --short --ignored"
			//IO.RunTool(["git","ls-files","--modified"],spath, ".*",function(match){
			IO.RunTool(["git","status","--porcelain","--ignored"],spath, "(..) (([^>]+) -> )?([^>]+)",function(g_repo_from_file,match){
				//if(match[0].indexOf(':')>=0){
				//	return;
				//}
				var s_name=match[4];
				if(s_name&&s_name[s_name.length-1]=='/'){
					s_name=s_name.substr(0,s_name.length-1);
				}
				var fname=IO.NormalizeFileName(spath+"/"+s_name);
				if(UI.Platform.ARCH=="win32"||UI.Platform.ARCH=="win64"){
					fname=fname.toLowerCase()
				}
				var repos=g_repo_from_file[fname]
				if(!repos){
					repos={};
					g_repo_from_file[fname]=repos
				}
				//repo -> status map
				if(UI.m_ui_metadata[fname]&&!repos[spath]){
					//count in ignored files if editted in qpad
					my_repo.files.push(fname)
				}
				repos[spath]=match[1]
			}.bind(undefined,g_repo_from_file),function(g_repo_parsing_context){
				UI.ED_8bitStringSort(my_repo.files)
				my_repo.is_parsing=0;
				ReparseDanglingDeps();
				ResumeProjectParsing(g_repo_parsing_context);
				UI.Refresh()
			}.bind(undefined,g_repo_parsing_context), 30)
		}, 30)
	})
	QueueProjectParser(IndexHelpFiles.bind(undefined,spath,my_repo,g_repo_parsing_context));
	return my_repo
}

var g_is_repo_detected={}
var DetectRepository=function(fname){
	var spath=UI.GetPathFromFilename(IO.NormalizeFileName(fname))
	if(UI.Platform.ARCH=="win32"||UI.Platform.ARCH=="win64"){
		spath=spath.toLowerCase()
		if(spath.length==2&&spath[1]==':'){
			return undefined;
		}
	}
	if(!spath){return undefined;}
	if(g_is_repo_detected[spath]){
		if(g_is_repo_detected[spath]=="?"){return undefined;}
		return g_is_repo_detected[spath];
	}
	///////////////////
	if(spath!='.'&&(IO.DirExists(spath+"/.git")||IO.DirExists(spath+"/.svn"))){
		//ParseGit(spath)
		ParseProject(spath)
		g_is_repo_detected[spath]=spath;
		if(!UI.g_is_dir_a_project[spath]){
			UI.g_is_dir_a_project[spath]="transient";
			UI.g_transient_projects.push(spath)
			UI.RefreshAllTabs()
		}
		return spath
	}
	///////////////////
	g_is_repo_detected[spath]="?";
	var ret=DetectRepository(spath);
	g_is_repo_detected[spath]=ret;
	return ret;
}

UI.GetEditorProject=function(fn,is_polite){
	fn=IO.NormalizeFileName(fn);
	var repos2=g_repo_from_file[fn];
	if(repos2){
		for(var spath in repos2){
			return spath;
		}
	}
	var spath_repo=DetectRepository(fn);
	if(spath_repo){return spath_repo;}
	if(is_polite){return undefined;}
	var sdir=UI.GetPathFromFilename(fn);
	ParseProject(sdir);
	return sdir;
};

UI.GetNotebookProject=function(fn){
	var sdir=UI.GetEditorProject(fn,"polite");
	if(!sdir){
		return IO.GetStoragePath();
	}
	return sdir;
};

UI.GetRepoByPath=function(spath){return g_repo_list[spath];}
UI.ClearFileListingCache=function(){
	g_repo_from_file={}
	g_repo_list={}
	g_is_repo_detected={}
	g_repo_parsing_context.canceled=1;
	g_repo_parsing_context={queue:[]};
}

//var FILE_LISTING_BUDGET=100
var FILE_LISTING_BUDGET=16
var FILE_LISTING_BUDGET_FS_VIEW=32;
var FILE_LISTING_BUDGET_PARSE_PROJECT=256;
var FILE_LISTING_BUDGET_HELP_INDEXING=16;//note that we read the *first line* of each file...
var HELP_FIRST_LINE_LENGTH_LIMIT=512;//keep it to the smallest definition of a disk sector
UI.g_file_listing_budget=FILE_LISTING_BUDGET;
W.FileItemOnDemand=function(){
	if(this.git_repo_to_list){
		ParseProject(this.git_repo_to_list);
		var repo=g_repo_list[this.git_repo_to_list]
		if(repo.is_parsing){
			return "keep";
		}
		//if(this.is_tree_view){
		//	return GenerateGitRepoTreeView(repo);
		//}
		var ret=[]
		var hist_keywords=this.search_text.toLowerCase().split(" ");
		for(var i=0;i<repo.files.length;i++){
			var fname_i=repo.files[i]
			if(UI.m_current_file_list.m_appeared_full_names[fname_i]){continue;}
			var fn_i_search=fname_i.toLowerCase()
			var is_invalid=0;
			var hl_ranges=[]
			var min_allowed_match=fn_i_search.lastIndexOf('/')+1;
			for(var j=0;j<hist_keywords.length;j++){
				var pj=fn_i_search.lastIndexOf(hist_keywords[j]);
				if(pj<0||pj+hist_keywords[j].length<=min_allowed_match){
					is_invalid=1
					break;
				}
				hl_ranges.push(pj,pj+hist_keywords[j].length)
			}
			if(is_invalid){continue;}
			//ret.push({name_to_find:fname_i})
			var ret2=W.FileItemOnDemand.call({
				name_to_find:fname_i,
				history_hl_ranges:hl_ranges})
			for(var j=0;j<ret2.length;j++){
				ret.push(ret2[j])
			}
		}
		return ret
	}
	if(!this.name_to_find){
		if(this.is_tree_view){
			var nd_parent=this.parent;
			var git_treeview_metadata=UI.m_ui_metadata["<project-treeview>"];
			var parent_expanded=(!nd_parent||!nd_parent.dropped&&git_treeview_metadata[nd_parent.name]);
			var is_hidden=!parent_expanded;
			this.h=(is_hidden?0:UI.default_styles.file_item.h_dense);
			if(is_hidden){
				this.dropped=1;
				return "drop";
			}
		}
		if(this.is_dir){
			var git_treeview_metadata=UI.m_ui_metadata["<project-treeview>"];
			if(git_treeview_metadata[this.name]){
				if(!this.has_expanded_items){
					//on-expand file search
					var ret=[];
					var find_context=IO.CreateEnumFileContext(this.name+"/*",3)
					var h_item=UI.default_styles.file_item.h_dense;
					while(find_context){
						var fnext=find_context()
						if(!fnext){
							find_context=undefined;
							break;
						}
						fnext.name=IO.NormalizeFileName(fnext.name);
						if(UI.Platform.ARCH=="win32"||UI.Platform.ARCH=="win64"){
							fnext.name=fnext.name.toLowerCase()
						}
						//avoid duplicate
						ret.push({
							name:fnext.name,
							size:fnext.size,
							is_dir:fnext.is_dir,
							time:fnext.time,
							is_tree_view:this.is_tree_view+1,
							parent:this,
							h:h_item})
					}
					ret.sort(function(a,b){return !!a.name_to_find-!!b.name_to_find||b.is_dir-a.is_dir||(a.name<b.name?-1:(a.name==b.name?0:1));})
					this.has_expanded_items=1;
					/////////////////
					var ret2=[];
					ret2.push(this);
					for(var i=0;i<ret.length;i++){
						var item_new=ret[i];
						var ret_new=W.FileItemOnDemand.call(item_new);
						if((typeof(ret_new))!='string'){
							ret2=ret2.concat(ret_new);
							continue;
						}
						ret2.push(item_new);
					}
					return ret2;
				}
			}else{
				this.has_expanded_items=0;
			}
		}
		return "keep"
	}
	if(!this.m_find_context){
		//enum both files and dirs
		this.m_find_context=IO.CreateEnumFileContext(this.name_to_find,3)
	}
	var ret=[];
	var h_item=UI.default_styles.file_item.h_dense;
	while(UI.g_file_listing_budget>0||this.is_tree_view){
		var fnext=this.m_find_context()
		if(!fnext){
			this.m_find_context=undefined;
			if(!ret.length&&this.create_if_not_found&&!IO.FileExists(this.create_if_not_found)){
				ret.push({
					name_to_create:this.create_if_not_found,
					name:this.create_if_not_found,
					h:h_item})
			}
			return ret
		}
		UI.g_file_listing_budget--;
		fnext.name=IO.NormalizeFileName(fnext.name);
		if(UI.Platform.ARCH=="win32"||UI.Platform.ARCH=="win64"){
			fnext.name=fnext.name.toLowerCase()
		}
		if(UI.m_current_file_list.m_appeared_full_names[fnext.name]&&!this.is_tree_view){continue;}
		UI.m_current_file_list.m_appeared_full_names[fnext.name]=1
		if(!this.is_tree_view){DetectRepository(fnext.name);}else{ParseProject(fnext.name);}
		//avoid duplicate
		var item_new={
			name:fnext.name,
			size:fnext.size,
			is_dir:fnext.is_dir,
			time:fnext.time,
			history_hl_ranges:this.history_hl_ranges,
			is_tree_view:this.is_tree_view,
			h:h_item}
		if(this.is_tree_view){
			var ret_new=W.FileItemOnDemand.call(item_new);
			if((typeof(ret_new))!='string'){
				ret=ret.concat(ret_new);
				continue;
			}
		}
		ret.push(item_new)
	}
	ret.push(this)
	return ret;
}

/*
var AddGitPath=function(dir_items,dir_seq,p){
	var s=dir_seq[p];
	if(p>=dir_seq.length-1){
		if(s=="*"){
			//repo-locating, return the repo-level thing
			return dir_items;
		}
		dir_items["*files"].push(dir_seq.join("/"))
		return;
	}
	var dir_p=dir_items[s];
	if(!dir_p){
		dir_p={"*subdirs":[],"*files":[]};
		dir_items["*subdirs"].push(dir_seq.slice(0,p+1).join("/"),dir_p)
		dir_items[s]=dir_p;
	}
	return AddGitPath(dir_p,dir_seq,p+1);
}

var FlushGitPaths=function(dir_items,ret,parent,depth){
	var subdirs=dir_items["*subdirs"];
	for(var i=0;i<subdirs.length;i+=2){
		UI.g_file_listing_budget=FILE_LISTING_BUDGET;
		var ret2=W.FileItemOnDemand.call({name_to_find:subdirs[i+0],is_tree_view:depth})
		for(var j=0;j<ret2.length;j++){
			ret2[j].parent=parent;
			ret2[j].is_tree_view=depth;
			ret.push(ret2[j])
		}
		FlushGitPaths(subdirs[i+1],ret,ret2[0],depth+1);
	}
	var files=dir_items["*files"];
	for(var i=0;i<files.length;i++){
		UI.g_file_listing_budget=FILE_LISTING_BUDGET;
		var ret2=W.FileItemOnDemand.call({name_to_find:files[i],is_tree_view:depth})
		for(var j=0;j<ret2.length;j++){
			ret2[j].parent=parent;
			ret2[j].is_tree_view=depth;
			ret.push(ret2[j])
		}
	}
}

var GenerateGitRepoTreeView=function(repo){
	//treeview rendering mode, generate hide-able stuff and infer the directory structure
	//the item objects *could* refer to each other
	//.is_hidden check in generated stuff
	var dir_items={"*subdirs":[],"*files":[]};
	var dir_repo=AddGitPath(dir_items,(repo.name+"/*").split("/"),0);
	for(var i=0;i<repo.files.length;i++){
		var fn_i=repo.files[i];
		AddGitPath(dir_items,fn_i.split("/"),0);
	}
	var ret=[];
	UI.g_file_listing_budget=FILE_LISTING_BUDGET;
	var ret2=W.FileItemOnDemand.call({name_to_find:repo.name,is_tree_view:1})
	for(var j=0;j<ret2.length;j++){
		ret2[j].parent=undefined;
		ret2[j].is_tree_view=1;
		ret.push(ret2[j])
	}
	FlushGitPaths(dir_repo,ret,ret2[0],2);
	//initialize the hidden-ness status
	for(var i=0;i<ret.length;i++){
		W.FileItemOnDemand.call(ret[i]);
	}
	return ret;
};*/

var IndexHelpFiles=function(spath,my_repo,g_repo_parsing_context){
	if(!IO.DirExists(spath+"/doc")||my_repo.m_helps_parsed){
		my_repo.m_helps_parsed=1;
		if(g_repo_parsing_context){
			ResumeProjectParsing(g_repo_parsing_context);
		}
		return;
	}
	if(my_repo.m_helps==undefined){
		my_repo.m_helps=[];
	}
	//file-only, recursive
	var find_context=IO.CreateEnumFileContext(spath+"/doc/*.md",5);
	for(var i=0;i<FILE_LISTING_BUDGET_HELP_INDEXING;i++){
		var fnext=find_context()
		if(!fnext){
			find_context=undefined
			break
		}
		var sname=fnext.name;
		var s_preview=IO.ReadLimited(sname,HELP_FIRST_LINE_LENGTH_LIMIT);
		if(s_preview){
			var pnewline=s_preview.indexOf('\n');
			if(pnewline>=0){
				s_preview=s_preview.substr(0,pnewline);
			}
			if(s_preview.length&&s_preview[0]=='#'){
				var pspace=s_preview.indexOf(' ');
				if(pspace>=0){
					s_preview=s_preview.substr(pspace+1);
				}
			}
			my_repo.m_helps.push({title:s_preview,title_search:s_preview.toLowerCase(),file_name:sname});
		}
	}
	if(find_context){
		UI.NextTick(IndexHelpFiles.bind(undefined,spath,my_repo,g_repo_parsing_context));
	}else{
		my_repo.m_helps_parsed=1;
		ResumeProjectParsing(g_repo_parsing_context);
	}
};

UI.ReindexHelp=function(spath){
	var my_repo=g_repo_list[spath];
	if(!my_repo){return;}
	my_repo.m_helps_parsed=0;
	my_repo.m_helps=undefined;
	QueueProjectParser(IndexHelpFiles.bind(undefined,spath,my_repo,g_repo_parsing_context));
}

var ParseProject=function(spath){
	if(g_repo_list[spath]){return;}
	if(IO.DirExists(spath+"/.git")){
		ParseGit(spath)
	}else{
		//}else if(IO.DirExists(spath+"/.svn")){
		//	ParseSVN(spath)
		//it's faster to parse the filesystem than to parse the SVN
		//filesystem "project"
		//don't put up status, just generate a file list
		var my_repo={name:spath,is_parsing:1,files:[]}
		g_repo_list[spath]=my_repo
		//file-only, recursive
		var find_context=IO.CreateEnumFileContext(spath+"/*",5);
		var fparse_batch=undefined;
		fparse_batch=function(g_repo_parsing_context){
			for(var i=0;i<FILE_LISTING_BUDGET_PARSE_PROJECT;i++){
				var fnext=find_context()
				if(!fnext){
					find_context=undefined
					break
				}
				var sname=fnext.name;
				my_repo.files.push(sname);
				var repos=g_repo_from_file[fnext.name]
				if(!repos){
					repos={};
					g_repo_from_file[fnext.name]=repos;
				}
				repos[spath]="  ";
			}
			if(find_context){
				UI.NextTick(fparse_batch)
			}else{
				UI.ED_8bitStringSort(my_repo.files)
				my_repo.is_parsing=0
				ReparseDanglingDeps();
				ResumeProjectParsing(g_repo_parsing_context);
			}
		}.bind(undefined,g_repo_parsing_context);
		QueueProjectParser(fparse_batch);
		UI.ReindexHelp(spath);
	}
}

W.FileItemOnDemandSort=function(obj){
	obj.items.sort(function(a,b){return !!a.name_to_find-!!b.name_to_find||b.is_dir-a.is_dir||(a.name<b.name?-1:(a.name==b.name?0:1));})
	var s_try_to_focus=(obj.item_template.owner.m_try_to_focus);
	if(s_try_to_focus){
		for(var i=0;i<obj.items.length;i++){
			if(obj.items[i].name&&obj.items[i].name==s_try_to_focus){
				obj.value=i;
				obj.AutoScroll();
				obj.item_template.owner.m_try_to_focus=undefined;
				break;
			}
		}
	}
}

var GetSmartFileName=function(arv,obj_param){
	if(!obj_param.display_name){
		var redo_queue=[]
		redo_queue.push(obj_param)
		for(;redo_queue.length;){
			var obj=redo_queue.pop()
			var ret=obj.display_name
			if(ret){return ret;}
			var name=obj.name
			var name_s=name
			for(;;){
				var pslash=name_s.lastIndexOf('/')
				var cur_name
				if(pslash<=0){
					cur_name=name
				}else{
					cur_name=name.substr(pslash+1)
				}
				var obj0=arv[cur_name];
				if(!obj0){
					arv[cur_name]=obj
					obj.display_name=cur_name
					break;
				}
				if(typeof obj0=='string'){
					//screwed, continue
				}else{
					//need to re-get obj0's name
					obj0.display_name=undefined
					redo_queue.push(obj0)
					//it's OK to display wrong name for a frame
					//UI.InvalidateCurrentFrame()
					UI.Refresh()
					arv[cur_name]='screwed'
				}
				if(pslash<=0){
					obj.display_name=cur_name
					break
				}
				name_s=name_s.substr(0,pslash)
			}
		}
	}
	return obj_param.display_name
}

var ZeroPad=function(n,w){
	var s=n.toString();
	if(s.length<w){
		var a=[]
		for(var i=s.length;i<w;i++){
			a.push('0')
		}
		a.push(s)
		s=a.join("")
	}
	return s
}

var FormatFileSize=function(size){
	if(size<1024){
		return size+"B"
	}else if(size<1048576){
		return (size/1024).toFixed(1)+"KB"
	}else if(size<1073741824){
		return (size/1048576).toFixed(1)+"MB"
	}else if(size<1099511627776){
		return (size/1073741824).toFixed(1)+"GB"
	}else{
		return (size/1099527776).toFixed(1)+"TB"
	}
}

UI.FormatRelativeTime=function(then,now){
	if(now[0]==then[0]){
		if(now[1]==then[1]){
			if(now[2]==then[2]){
				//the space disables translation
				return UI.Format( "@1:@2",ZeroPad(then[3],2),ZeroPad(then[4],2,10))
			}
			//else if(now[2]==then[2]+1){
			//	return UI.Format("@1:@2 Yesterday",ZeroPad(then[3],2),ZeroPad(then[4],2,10))
			//}
		}
		return UI.MonthDay(then[1],then[2])
	}else{
		//the space disables translation
		return UI.Format( "@1/@2/@3",ZeroPad(then[1]+1,2),ZeroPad(then[2]+1,2),then[0])
	}
}

var OpenInPlace=function(obj,name){
	var fn=IO.NormalizeFileName(name)
	/*
	var editor_widget=obj.editor_widget
	var my_tabid=undefined
	if(editor_widget&&!editor_widget.m_is_special_document){editor_widget=undefined;}
	if(editor_widget){
		for(var i=0;i<UI.g_all_document_windows.length;i++){
			if(UI.g_all_document_windows[i].main_widget===editor_widget){
				my_tabid=i
				break
			}
		}
	}
	*/
	//alt+q searched switch should count BIG toward the switching history
	if(UI.m_previous_document){
		var counts=UI.m_ui_metadata[UI.m_previous_document]
		if(counts){counts=counts.m_tabswitch_count;}
		for(var i=0;i<UI.g_all_document_windows.length;i++){
			//if(i==my_tabid){continue;}
			if(!UI.g_all_document_windows[i].main_widget){continue;}
			var counts_i=UI.g_all_document_windows[i].main_widget.m_tabswitch_count
			if(counts_i){
				counts=counts_i
				break
			}
		}
		if(counts){
			UI.IncrementTabSwitchCount(counts,fn,8)
		}
	}
	//search for existing windows
	//my_tabid refers to the preview tab
	/*for(var i=0;i<UI.g_all_document_windows.length;i++){
		if(i!=my_tabid&&UI.g_all_document_windows[i].file_name==fn){
			UI.top.app.document_area.SetTab(i)
			if(my_tabid!=undefined){UI.top.app.document_area.CloseTab(my_tabid);}
			return
		}
	}
	if(editor_widget){
		var lang=UI.ED_GetFileLanguage(fn);
		if(lang.is_binary){
			if(my_tabid!=undefined){UI.top.app.document_area.CloseTab(my_tabid);}
			UI.NewBinaryEditorTab(fn)
			return
		}
		editor_widget.file_name=fn
		editor_widget.doc=undefined
		editor_widget.m_is_special_document=undefined;
		editor_widget.m_is_preview=undefined;
		UI.top.app.quit_on_zero_tab=0;
		UI.m_current_file_list=undefined
		UI.top.app.document_area.SetTab(my_tabid)
	}else{
		UI.OpenEditorWindow(fn)
	}*/
	//UI.ClearFileListingCache();
	if(IO.FileExists(fn)){
		UI.OpenFile(fn);
	}else if(fn){
		//new file
		UI.OpenEditorWindow(fn)
	}
	UI.Refresh()
}

var FileItem_prototype={
	OnDblClick:function(event){
		if(this.name_to_find){return;}
		if(this.is_dir){
			if(this.is_tree_view){
				var git_treeview_metadata=UI.m_ui_metadata["<project-treeview>"];
				git_treeview_metadata[this.name]=!git_treeview_metadata[this.name];
				UI.Refresh();
				return;
			}
			var obj=this.owner
			var fbar=obj.find_bar_edit
			var ed=fbar.ed
			fbar.HookedEdit([0,ed.GetTextSize(),this.name+'/'])
			fbar.sel1.ccnt=ed.GetTextSize()
			fbar.sel0.ccnt=fbar.sel1.ccnt
			fbar.CallOnChange()
			UI.Refresh()
			return
		}
		var obj=this.owner;
		OpenInPlace(obj,this.name)
		var fbar=obj.find_bar_edit
		var ed=fbar.ed
		if(ed.GetTextSize()){
			fbar.HookedEdit([0,ed.GetTextSize(),undefined])
			fbar.sel0.ccnt=0
			fbar.sel1.ccnt=0
			fbar.CallOnChange()
		}
	},
};
W.FileItem=function(id,attrs){
	var obj=UI.StdWidget(id,attrs,"none",UI.default_styles.file_item);
	var parent_list_view=UI.context_parent;
	if(obj.is_tree_view){
		var dx_indent=(obj.is_tree_view-1)*obj.treeview_indent;
		obj.x+=dx_indent;
		obj.w-=dx_indent;
		var s_try_to_focus=(obj.owner.m_try_to_focus);
		if(s_try_to_focus){
			var git_treeview_metadata=UI.m_ui_metadata["<project-treeview>"];
			var is_me_focus=0;
			if(obj.name==s_try_to_focus){
				is_me_focus=1;
			}else if(obj.is_dir&&!git_treeview_metadata[obj.name]){
				if(obj.name.length<s_try_to_focus&&s_try_to_focus.substr(0,obj.name.length)==obj.name){
					is_me_focus=1;
				}
			}
			if(is_me_focus){
				var list_items=obj.owner.file_list.items;
				for(var j=0;j<list_items.length;j++){
					if(list_items[j].name==obj.name){
						obj.owner.file_list.OnChange(j);
						obj.owner.m_try_to_focus=undefined;
						UI.Refresh()
						break;
					}
				}
			}
		}
	}
	UI.Begin(obj)
		//icon, name, meta-info
		//hopefully go without a separator line
		if(obj.y<parent_list_view.y+parent_list_view.h&&obj.y+obj.h>parent_list_view.y){
			if(obj.caption){
				var dims=UI.MeasureText(obj.name_font,obj.caption);
				W.Text("",{x:obj.x+(obj.w-dims.w)*0.5,y:obj.y+4,
					font:obj.name_font,text:obj.caption,
					color:UI.default_styles.code_editor.find_message_color})
			}else if(obj.git_repo_to_list){
				//display a searching... text
				W.Text("",{x:obj.x+4,y:obj.y+2,
					font:obj.name_font,text:UI._("Parsing project @1...").replace("@1",obj.git_repo_to_list),
					color:obj.misc_color})
			}else if(obj.name_to_find){
				//display a searching... text
				W.Text("",{x:obj.x+4,y:obj.y+2,
					font:obj.name_font,text:UI._("Searching @1...").replace("@1",obj.name_to_find),
					color:obj.misc_color})
			}else{//normal file
				var icon_code=obj.icon_code;
				var ext_color=obj.ext_color;
				var sname=obj.short_name;
				var s_misc_text=obj.s_misc_text;
				if(!icon_code){
					var s_ext=UI.GetFileNameExtension(obj.name)
					var language_id=Language.GetNameByExt(s_ext)
					var desc=Language.GetDescObjectByName(language_id)
					icon_code=(Language.g_icon_overrides[s_ext]||desc.file_icon||'档').charCodeAt(0)
					ext_color=obj.file_icon_color;//(desc.file_icon_color||obj.file_icon_color)
					if(obj.is_dir){
						ext_color=obj.dir_icon_color;
						if(obj.is_tree_view&&UI.m_ui_metadata["<project-treeview>"][obj.name]){
							icon_code=0x5f00;//'开'.charCodeAt(0)
						}else{
							icon_code=0x5939;//'夹'.charCodeAt(0)
						}
					}
					if(obj.name_to_create){
						ext_color=0x55444444
						icon_code='新'.charCodeAt(0)
					}
					sname=UI.RemovePath(obj.name);
					if(obj.is_dir){sname=sname+"/";}
					var s_time=obj.name_to_create?"":UI.FormatRelativeTime(obj.time,UI.m_current_file_list.m_now);
					s_misc_text=(
						obj.name_to_create?
							UI._("Create new file"):
							(obj.is_dir?s_time:FormatFileSize(obj.size)+", "+s_time));
					obj.icon_code=icon_code;
					obj.ext_color=ext_color;
					obj.short_name=sname;
					obj.s_misc_text=s_misc_text;
				}
				//var sel_bgcolor=(ext_color|0xff000000)
				var sel_bgcolor=obj.owner.activated?obj.sel_bgcolor:obj.sel_bgcolor_deactivated;
				//////////////
				var icon_font=obj.icon_font_dense;
				var h_icon=obj.h_icon_dense;
				var w_icon=UI.GetCharacterAdvance(icon_font,icon_code)
				if(obj.selected){
					ext_color=obj.sel_file_icon_color
					UI.RoundRect({
						x:obj.x,y:obj.y+2,w:obj.w-12,h:obj.h-4,
						color:sel_bgcolor})
				}
				var name_color=obj.name_color;
				//var stag=undefined;
				//(obj.owner.m_file_list_repo||UI.m_ui_metadata.new_page_mode!='fs_view')&&
				if(obj.is_tree_view!=1){
					var repos=g_repo_from_file[obj.name]
					if(repos){
						var s_git_status=undefined;
						for(var skey in repos){
							s_git_status=repos[skey];
							//if(obj.is_tree_view!=1){
							//	stag=skey;
							//}
							break;
						}
						//if(UI.m_ui_metadata.new_page_mode!='fs_view'){
						//}else{
						//	s_git_status=repos[obj.owner.m_file_list_repo];
						//}
						var s_git_icon=undefined;
						var git_icon_color=undefined;
						if(s_git_status){
							//detect new / modified / conflicted / ignored / untracked
							if(s_git_status=='!!'){
								//ignored
								ext_color&=0x7fffffff;
								name_color&=0x7fffffff;
							}else if(s_git_status=='??'){
								//untracked
								name_color=obj.color_git_untracked;
								s_git_icon="问";
							}else if(s_git_status[0]=='U'||s_git_status[1]=='U'||s_git_status=='AA'){
								//conflicted
								name_color=obj.color_git_conflicted;
								s_git_icon="叹";
							}else if(s_git_status[0]=='A'||s_git_status[1]=='A'){
								//new
								name_color=obj.color_git_new;
								s_git_icon="加";
							}else if(s_git_status!='  '){
								//modified
								name_color=obj.color_git_modified;
								git_icon_color=obj.color_git_conflicted;
								s_git_icon="改";
							}
						}
					}
				}
				if(sname&&sname[0]=='.'){
					ext_color&=0x7fffffff;
					name_color&=0x7fffffff;
				}
				//if(s_git_icon){
				//	ext_color&=0x7fffffff;
				//}
				UI.DrawChar(icon_font,obj.x,obj.y+(obj.h-h_icon)*0.5,ext_color,icon_code)
				if(s_git_icon){
					UI.DrawChar(obj.icon_font_git,
						obj.x+(h_icon-obj.h_icon_git),obj.y+(obj.h-obj.h_icon_git-2),
						obj.selected?sel_bgcolor:UI.default_styles.sxs_new_page.color,0x5768)//坨
					UI.DrawChar(obj.icon_font_git,
						obj.x+(h_icon-obj.h_icon_git),obj.y+(obj.h-obj.h_icon_git-2),
						obj.selected?obj.sel_name_color:(git_icon_color||name_color),s_git_icon.charCodeAt(0))
				}
				var dims_misc=UI.MeasureText(obj.misc_font,s_misc_text);
				var dims_misc_w0=dims_misc.w;
				/////////////////////////
				//forget button
				if(UI.g_is_dir_a_project[obj.name]=='permanent'){
					W.Button("forget_button",{style:obj.button_style,
						x:16,y:0,
						value:obj.selected,
						text:"✕",
						tooltip:UI._("Unpin this project"),
						anchor:'parent',anchor_align:'right',anchor_valign:'center',
						OnClick:function(){
							UI.RemoveProjectDir(obj.name)
						}
					})
					dims_misc.w+=obj.forget_button.w;
				}else if(UI.m_ui_metadata[obj.name]){
					W.Button("forget_button",{style:obj.button_style,
						x:16,y:0,
						value:obj.selected,
						text:"✕",
						tooltip:UI._("Forget this file"),
						anchor:'parent',anchor_align:'right',anchor_valign:'center',
						OnClick:function(){
							UI.ForgetFile(obj)
						}
					})
					dims_misc.w+=obj.forget_button.w;
				}
				/////////////////////////
				var name_font=obj.name_font;
				var name_font_bold=obj.name_font_bold;
				var w_name=obj.w-20-w_icon-dims_misc.w-4;
				if(obj.owner.m_is_fs_view||obj.is_tree_view){
					var dims=UI.MeasureText(name_font,sname);
					if(dims.w>w_name){
						s_misc_text='';
						dims_misc.w-=dims_misc_w0;
						w_name=Math.max(obj.w-20-w_icon-dims_misc.w-4,64);
						if(dims.w>w_name){
							var size=obj.name_font_size*(w_name/dims.w);
							name_font=UI.Font(UI.font_name,size,-50);
							name_font_bold=UI.Font(UI.font_name,size,100);
						}
					}
					W.Text("",{x:obj.x+w_icon+2,y:obj.y+(obj.h-UI.GetFontHeight(name_font))*0.5-2,
						font:name_font,text:sname,
						color:obj.selected?obj.sel_name_color:name_color})
				}else{
					var sname=GetSmartFileName(UI.m_current_file_list.m_appeared_names,obj)
					if(obj.name_to_create){sname="";}
					var dims=UI.MeasureText(name_font,obj.name);
					if(dims.w>w_name){
						s_misc_text='';
						dims_misc.w-=dims_misc_w0;
						w_name=Math.max(obj.w-20-w_icon-dims_misc.w-4,64);
						if(dims.w>w_name){
							var size=obj.name_font_size*(w_name/dims.w);
							name_font=UI.Font(UI.font_name,size,-50);
							name_font_bold=UI.Font(UI.font_name,size,100);
						}
					}
					var lg_basepath=obj.name.length-sname.length
					if(lg_basepath>0){
						W.Text("",{x:obj.x+w_icon+2,y:obj.y+(obj.h-UI.GetFontHeight(name_font))*0.5-2,
							font:name_font,text:obj.name.substr(0,lg_basepath),
							color:obj.name_to_create?(obj.selected?obj.sel_misc_color:obj.misc_color):(obj.selected?obj.sel_basepath_color:obj.basepath_color)})
					}
					W.Text("",{x:obj.x+w_icon+2+UI.MeasureText(name_font,obj.name.substr(0,lg_basepath)).w,y:obj.y+(obj.h-UI.GetFontHeight(name_font))*0.5-2,
						font:name_font,text:sname,
						color:obj.selected?obj.sel_name_color:obj.name_color})
					if(obj.history_hl_ranges&&!obj.name_to_create){
						//highlight keywords in history items only
						//var base_offset=obj.selected?0:(obj.name.length-sname.length);
						for(var i=0;i<obj.history_hl_ranges.length;i+=2){
							var p0=obj.history_hl_ranges[i+0];//Math.max(obj.history_hl_ranges[i+0]-base_offset,0);
							var p1=obj.history_hl_ranges[i+1];//Math.max(obj.history_hl_ranges[i+1]-base_offset,0);
							if(p0<p1){
								var x=obj.x+w_icon+2+UI.MeasureText(name_font,obj.name.substr(0,p0)).w
								W.Text("",{x:x,y:obj.y+(obj.h-UI.GetFontHeight(name_font))*0.5-2,
									font:name_font_bold,text:obj.name.substr(p0,p1-p0),
									color:obj.selected?obj.sel_name_color:obj.name_color})
							}
						}
					}
				}
				if(s_misc_text){
					W.Text("",{x:obj.x+obj.w-dims_misc.w-20,y:obj.y+(obj.h-dims_misc.h)*0.5,
						font:obj.misc_font,text:s_misc_text,
						color:obj.selected?obj.sel_misc_color:obj.misc_color})
				}
			}
		}
	UI.End()
	return obj
}

var fnewpage_findbar_plugin=function(){
	this.AddEventHandler('ESC',function(){
		var obj=this.owner
		var tab_frontmost=UI.GetFrontMostEditorTab();
		if(tab_frontmost){
			UI.top.app.document_area.SetTab(tab_frontmost.__global_tab_id)
			//for(var i=0;i<UI.g_all_document_windows.length;i++){
			//	if(UI.g_all_document_windows[i]==tab_frontmost){
			//		UI.top.app.document_area.SetTab(i)
			//		break
			//	}
			//}
		}
		var fbar=obj.find_bar_edit;
		var ed=fbar.ed;
		if(ed.GetTextSize()){
			fbar.HookedEdit([0,ed.GetTextSize(),undefined])
			fbar.sel0.ccnt=0
			fbar.sel1.ccnt=0
			fbar.CallOnChange()
		}
		//if(obj.m_close_on_esc){
		//	UI.top.app.document_area.CloseTab()
		//	for(var i=0;i<UI.g_all_document_windows.length;i++){
		//		if(UI.g_all_document_windows[i].file_name==UI.m_previous_document){
		//			UI.top.app.document_area.SetTab(i)
		//			break
		//		}
		//	}
		//}else{
		//	var editor_widget=obj.owner
		//	if(editor_widget){
		//		editor_widget.m_is_special_document=0
		//		if(editor_widget.m_file_name_before_preview){
		//			//clear preview
		//			editor_widget.file_name=editor_widget.m_file_name_before_preview
		//			editor_widget.doc=undefined
		//			editor_widget.m_is_preview=0
		//			editor_widget.m_file_name_before_preview=undefined
		//		}
		//	}
		//}
		//UI.m_current_file_list=undefined;
		//UI.ClearFileListingCache();
		UI.Refresh()
	})
	this.OnMouseWheel=function(event){
		var obj=this.owner
		obj.file_list.OnMouseWheel(event)
	}
	var fpassthrough=function(key,event){
		var obj=this.owner
		obj.file_list.OnKeyDown(event)
	}
	this.AddEventHandler('LEFT',function(){
		var obj=this.owner
		if(obj.m_is_project_mode){
			var git_treeview_metadata=UI.m_ui_metadata["<project-treeview>"];
			var cur_item=obj.file_list.items[obj.file_list.value];
			if(cur_item.is_tree_view&&cur_item.is_dir&&git_treeview_metadata[cur_item.name]){
				git_treeview_metadata[cur_item.name]=0;
				UI.Refresh();
				return;
			}
			if(cur_item.is_tree_view&&cur_item.parent&&obj.file_list&&obj.file_list.items){
				//go to parent *AND* fold
				for(var i=0;i<obj.file_list.items.length;i++){
					if(obj.file_list.items[i]==cur_item.parent){
						obj.file_list.OnChange(i);
						UI.Refresh();
						return;
					}
				}
			}
		}
		return 1;
	})
	this.AddEventHandler('RIGHT',function(){
		var obj=this.owner
		if(obj.m_is_project_mode){
			var git_treeview_metadata=UI.m_ui_metadata["<project-treeview>"];
			var cur_item=obj.file_list.items[obj.file_list.value];
			if(cur_item.is_tree_view&&cur_item.is_dir){
				git_treeview_metadata[cur_item.name]=1;
				UI.Refresh();
				return;
			}
		}
		return 1;
	})
	this.AddEventHandler('change',function(){
		var obj=this.owner
		obj.m_file_list=undefined
		obj.m_try_to_focus=undefined;
		UI.Refresh()
	})
	this.AddEventHandler('F5',function(){
		UI.ClearFileListingCache();
		var obj=this.owner
		obj.m_file_list=undefined
		obj.m_try_to_focus=undefined;
		UI.Refresh()
		return 1;
	})
	this.AddEventHandler('RETURN RETURN2',fpassthrough)
	this.AddEventHandler('UP',fpassthrough)
	this.AddEventHandler('DOWN',fpassthrough)
	this.AddEventHandler('PGUP',fpassthrough)
	this.AddEventHandler('PGDN',fpassthrough)
	this.AddEventHandler('TAB',function(key,event){
		var s_search_text=(this.ed.GetText()||"")
		var spath=s_search_text
		var ccnt=Duktape.__byte_length(spath)
		if(spath.length&&this.sel0.ccnt==ccnt&&this.sel1.ccnt==ccnt){
			spath=IO.ProcessUnixFileName(spath.replace(g_regexp_backslash,"/")).replace(g_regexp_backslash,"/")
			if(spath.search(g_regexp_abspath)>=0){
				//do nothing: it's absolute
			}else{
				spath=UI.m_new_document_search_path+"/"+spath
			}
			if(UI.Platform.ARCH=="win32"||UI.Platform.ARCH=="win64"){
				spath=spath.toLowerCase()
			}
			var find_context=IO.CreateEnumFileContext(spath+"*",3)
			var s_common=undefined
			for(;;){
				var fnext=find_context()
				if(!fnext){
					find_context=undefined
					break
				}
				var sname=fnext.name
				if(UI.Platform.ARCH=="win32"||UI.Platform.ARCH=="win64"){
					sname=sname.toLowerCase()
				}
				if(fnext.is_dir){
					sname=sname+"/"
				}
				if(!s_common){
					s_common=sname
				}else{
					for(var i=0;i<s_common.length;i++){
						if(i>=sname.length||sname[i]!=s_common[i]){
							s_common=s_common.substr(0,i)
							break;
						}
					}
				}
				if(s_common.length<=spath.length){break;}
			}
			if(s_common&&s_common.length>spath.length){
				//path completion
				var s_insertion=s_common.slice(spath.length)
				this.HookedEdit([ccnt,0,s_insertion])
				this.sel0.ccnt=ccnt+Duktape.__byte_length(s_insertion)
				this.sel1.ccnt=ccnt+Duktape.__byte_length(s_insertion)
				this.CallOnChange()
				this.UserTypedChar()
			}
		}
	})
	this.AddEventHandler('ALT+UP',function(key,event){
		if(!this.owner.m_is_fs_view){return 1;}
		var ccnt_end=this.ed.GetTextSize();
		var spath=this.ed.GetText();
		if(spath.search(g_regexp_abspath)>=0){
			//do nothing: it's absolute
		}else{
			spath=UI.m_new_document_search_path+"/"+spath
		}
		var s=IO.NormalizeFileName(spath);
		var s2=UI.GetPathFromFilename(UI.GetPathFromFilename(s));
		if(s2=='.'){return 1;}
		var n_removed=Duktape.__byte_length(s)-Duktape.__byte_length(s2);
		if(!(n_removed>0)){return 1;}
		this.HookedEdit([0,ccnt_end,s2+'/'])
		this.CallOnChange()
		if(s.length>0){
			this.owner.m_try_to_focus=s.substr(0,s.length-1);
		}
		ccnt_end=this.ed.GetTextSize();
		this.SetSelection(ccnt_end,ccnt_end);
		return 0;
	})
	this.AddEventHandler('ALT+LEFT',function(key,event){
		if(!this.owner.m_is_fs_view){return 1;}
		this.Undo()
	})
	this.AddEventHandler('ALT+RIGHT',function(key,event){
		if(!this.owner.m_is_fs_view){return 1;}
		this.Redo()
	})
}

var g_regexp_backslash=new RegExp("\\\\","g");
var g_regexp_abspath=new RegExp("^(([a-zA-Z]:[\\\\/])|([\\\\/~]))");
var g_regexp_is_path=new RegExp("^(([a-zA-Z]:[\\\\/])|[~\\\\/]|([.]+[\\\\/])).*$");
var FILE_RELEVANCE_SWITCH_SCORE=32
var FILE_RELEVANCE_REPO_SCORE=8
var FILE_RELEVANCE_BASE_SCORE=4
var FILE_RELEVANCE_SCORE_DECAY=0.99;
var g_root_items;
(function(){
	if(UI.Platform.ARCH=="win32"||UI.Platform.ARCH=="win64"){
		g_root_items=[];
		for(var i=2;i<26;i++){
			g_root_items.push({"name":String.fromCharCode(97+i)+":","is_dir":1});
		}
	}else{
		g_root_items=[{"name":"","is_dir":1}];
	}
})()
//var FILE_RELEVANCE_SAME_REPO_NON_HIST=16
W.FileBrowserPage=function(id,attrs){
	if(UI.enable_timing){
		UI.TimingEvent("entering FileBrowserPage");
	}
	var obj=UI.StdWidget(id,attrs,"sxs_new_page");
	UI.Begin(obj)
	UI.RoundRect(obj)
	////////////////////////////////////////////
	//the find bar
	UI.RoundRect({x:obj.x,y:obj.y,w:obj.w,h:obj.h_find_bar,
		color:obj.find_bar_bgcolor})
	var w_buttons=0;
	if(!s_search_text){
		//manage projects button
		W.Button("manage_button",{
			x:w_buttons,y:0,h:obj.h_find_bar,
			value:obj.selected,padding:8,
			font:UI.icon_font_20,
			text:"换",
			tooltip:UI._("Manage projects..."),
			anchor:'parent',anchor_align:'right',anchor_valign:'up',
			OnClick:function(){
				//UI.top.app.document_area.CloseTab()
				UI.OpenEditorWindow("*project_list")
			}
		})
		w_buttons+=obj.manage_button.w
	}
	W.Button("refresh_button",{
		x:w_buttons,y:0,h:obj.h_find_bar,
		value:obj.selected,padding:8,
		font:UI.icon_font_20,
		text:"刷",
		tooltip:UI._("Refresh"),// - F5
		anchor:'parent',anchor_align:'right',anchor_valign:'up',
		OnClick:function(){
			UI.ClearFileListingCache();
			this.m_file_list=undefined
			this.m_try_to_focus=undefined;
			UI.Refresh()
		}.bind(obj)
	})
	w_buttons+=obj.refresh_button.w
	var rect_bar=UI.RoundRect({
		x:obj.x+obj.find_bar_padding,y:obj.y+obj.find_bar_padding,
		w:obj.w-w_buttons-obj.find_bar_padding*2,h:obj.h_find_bar-obj.find_bar_padding*2,
		color:obj.find_bar_color,
		round:obj.find_bar_round})
	UI.DrawChar(UI.icon_font_20,obj.x+obj.find_bar_padding*2,obj.y+(obj.h_find_bar-UI.GetCharacterHeight(UI.icon_font_20))*0.5,
		obj.find_bar_hint_color,'s'.charCodeAt(0))
	var x_find_edit=obj.x+obj.find_bar_padding*3+UI.GetCharacterAdvance(UI.icon_font_20,'s'.charCodeAt(0));
	var w_find_edit=rect_bar.x+rect_bar.w-obj.find_bar_padding-x_find_edit;
	var is_find_bar_new=!obj.find_bar_edit;
	W.Edit("find_bar_edit",{
		style:obj.find_bar_editor_style,
		x:x_find_edit,w:w_find_edit,y:rect_bar.y,h:rect_bar.h,
		owner:obj,
		precise_ctrl_lr_stop:UI.TestOption("precise_ctrl_lr_stop"),
		same_line_only_left_right:!UI.TestOption("left_right_line_wrap"),
		plugins:[fnewpage_findbar_plugin],
		default_focus:2,
		tab_width:UI.GetOption("tab_width",4),
	});
	//if(is_find_bar_new&&UI.m_ui_metadata.new_page_mode=='fs_view'){
	//	//set initial path - UI.m_new_document_search_path
	//	obj.find_bar_edit.HookedEdit([0,0,(UI.m_new_document_search_path+"/")||"./"])
	//	var ccnt=obj.find_bar_edit.ed.GetTextSize();
	//	obj.find_bar_edit.SetSelection(ccnt,ccnt)
	//}
	if(!obj.find_bar_edit.ed.GetTextSize()&&!obj.find_bar_edit.ed.m_IME_overlay){
		W.Text("",{x:x_find_edit+2,w:w_find_edit,y:rect_bar.y,h:rect_bar.h,
			font:obj.find_bar_hint_font,color:obj.find_bar_hint_color,
			text:UI._("Type to search or browse")})
	}
	////////////////////////////////////////////
	UI.m_current_file_list=obj.m_current_file_list
	if(obj.m_is_fs_view){
		UI.g_file_listing_budget=FILE_LISTING_BUDGET_FS_VIEW;
	}else{
		UI.g_file_listing_budget=FILE_LISTING_BUDGET;
	}
	var files=obj.m_file_list;
	var first_time=0
	if(!files){
		obj.m_current_file_list={
			m_now:IO.WallClockTime(),
			m_owner:obj,
			m_appeared_names:{},
			m_appeared_full_names:{},
			m_listed_git_repos:{},
		}
		obj.m_is_fs_view=0;
		UI.m_current_file_list=obj.m_current_file_list
		files=[];
		///////////////////////
		var s_search_text=obj.find_bar_edit.ed.GetText()
		var projects=(UI.m_ui_metadata["<projects>"]||[]);
		obj.m_is_project_mode=(!s_search_text);
		//sync current projects to a map - UI.g_transient_projects
		//UI.m_ui_metadata.new_page_mode!='fs_view'&&
		if(!s_search_text){
			//empty search string, project view
			var git_treeview_metadata=UI.m_ui_metadata["<project-treeview>"];
			if(!git_treeview_metadata){
				git_treeview_metadata={};
				UI.m_ui_metadata["<project-treeview>"]=git_treeview_metadata;
			}
			if(projects.length>0){
				files.push({caption:UI._("Projects"),no_selection:1,h:32})
				for(var i=0;i<projects.length;i++){
					//files.push({git_repo_to_list:projects[i], is_tree_view:1, search_text:""})
					files.push({name_to_find:projects[i], is_tree_view:1})
				}
			}
			if(UI.g_transient_projects.length>0){
				files.push({caption:UI._("Auto-detected repositories"),no_selection:1,h:32})
				UI.g_transient_projects.sort(function(a,b){
					a=UI.RemovePath(a);
					b=UI.RemovePath(b);
					if(a<b){return -1;}else{return a>b?1:0;}
				});
				for(var i=0;i<UI.g_transient_projects.length;i++){
					files.push({name_to_find:UI.g_transient_projects[i], is_tree_view:1, search_text:""})
				}
			}
			//var s_git_view_path=DetectRepository(UI.m_previous_document);
			//obj.m_file_list_repo=s_git_view_path;
			//set current - m_try_to_focus
			obj.m_try_to_focus=UI.m_previous_document
		}else{
			//it's more of a smart interpretation of the user-typed string, not a full-blown explorer
			//history mode
			//only do space split for hist mode
			//if(s_search_text.indexOf('/')<0){
			var hist=UI.m_ui_metadata["<history>"]
			if(hist&&!(s_search_text.match(g_regexp_is_path))){
				var hist_keywords=s_search_text.toLowerCase().split(" ");
				for(var i=hist.length-1;i>=0;i--){
					var fn_i=hist[i],fn_i_search=fn_i.toLowerCase()
					var is_invalid=0;
					var hl_ranges=[]
					var min_allowed_match=fn_i_search.lastIndexOf('/')+1;
					for(var j=0;j<hist_keywords.length;j++){
						var pj=fn_i_search.lastIndexOf(hist_keywords[j]);
						if(pj<0||pj+hist_keywords[j].length<=min_allowed_match){
							is_invalid=1
							break;
						}
						hl_ranges.push(pj,pj+hist_keywords[j].length)
					}
					if(is_invalid){continue;}
					if(files.length>=MAX_HISTORY_ITEMS){
						continue;
					}
					files.push({name_to_find:fn_i, relevance:FILE_RELEVANCE_BASE_SCORE,hist_ord:i,
						history_hl_ranges:hl_ranges})
				}
				var mul=1.0
				for(var i=0;i<files.length;i++){
					files[i].relevance*=mul
					mul*=FILE_RELEVANCE_SCORE_DECAY
				}
				if(UI.m_previous_document){
					var fn_current=UI.m_previous_document
					var tabswitch_count=UI.m_ui_metadata[fn_current]
					if(tabswitch_count){tabswitch_count=tabswitch_count.m_tabswitch_count}
					if(tabswitch_count&&tabswitch_count["$"]){
						for(var i=0;i<files.length;i++){
							var fn_switchto=files[i].name_to_find
							files[i].relevance+=(tabswitch_count[fn_switchto]||0)/Math.max(tabswitch_count["$"],UI.MAX_TAB_SWITCH_COUNT)*FILE_RELEVANCE_SWITCH_SCORE
						}
					}
					var repos=g_repo_from_file[fn_current]
					if(repos){
						for(var i=0;i<files.length;i++){
							var fn_switchto=files[i].name_to_find
							var repos2=g_repo_from_file[fn_switchto]
							if(repos2){
								for(var spath in repos2){
									if(repos[spath]!=undefined){
										files[i].relevance+=FILE_RELEVANCE_REPO_SCORE
										break;
									}
								}
							}
						}
					}
				}
				//git project part
				var spath_repo=DetectRepository(UI.m_new_document_search_path+"/*")
				//print(spath_repo,UI.m_new_document_search_path)
				if(spath_repo){
					if(!UI.m_current_file_list.m_listed_git_repos[spath_repo]){
						UI.m_current_file_list.m_listed_git_repos[spath_repo]=1;
						files.push({git_repo_to_list:spath_repo, search_text:s_search_text,
							relevance:FILE_RELEVANCE_REPO_SCORE,hist_ord:-1})
					}
					var projects=UI.m_ui_metadata["<projects>"];
					for(var i=0;i<projects.length;i++){
						var spath_repo_i=projects[i];
						if(!UI.m_current_file_list.m_listed_git_repos[spath_repo_i]){
							UI.m_current_file_list.m_listed_git_repos[spath_repo_i]=1;
							files.push({git_repo_to_list:spath_repo_i, search_text:s_search_text,
								relevance:0,hist_ord:-1})
						}
					}
				}
				//sort by relevance
				files.sort(function(a,b){return b.relevance-a.relevance||b.hist_ord-a.hist_ord;});
			}else{
				obj.m_is_fs_view=1;
			}
			//file system part, leave them unsorted
			var spath=s_search_text
			obj.m_file_list_repo=undefined;
			if(spath.length||!files.length){
				spath=IO.ProcessUnixFileName(spath.replace(g_regexp_backslash,"/")).replace(g_regexp_backslash,"/")
				if(spath.search(g_regexp_abspath)>=0){
					//do nothing: it's absolute
				}else{
					spath=UI.m_new_document_search_path+"/"+spath
				}
				//git project part
				var spath_repo=DetectRepository(spath+"*")
				obj.m_file_list_repo=spath_repo;
				if(spath_repo&&!obj.m_is_fs_view){
					if(!UI.m_current_file_list.m_listed_git_repos[spath_repo]){
						UI.m_current_file_list.m_listed_git_repos[spath_repo]=1
						files.push({git_repo_to_list:spath_repo, search_text:s_search_text})
					}
				}
				files.push({
					name_to_find:spath+"*",
					create_if_not_found:spath,
				})
			}
		}
		//////////////
		obj.m_file_list=files
		obj.file_list=undefined
		first_time=1
	}
	UI.default_styles.file_item.__proto__=FileItem_prototype;
	UI.m_current_file_list.m_ui_obj=W.ListView('file_list',{
		x:obj.x+4,y:obj.y+obj.h_find_bar+4,w:obj.w-10,h:obj.h-obj.h_find_bar-4,
		mouse_wheel_speed:80,
		dimension:'y',layout_spacing:0,layout_align:'fill',
		OnDemandSort:obj.m_is_fs_view?W.FileItemOnDemandSort:undefined,
		OnDemand:W.FileItemOnDemand,
		OnFocus:function(){
			UI.SetFocus(obj.find_bar_edit);
			UI.Refresh();
		},
		OnChange:function(value){
			//if(this.value==value){return;}
			W.ListView_prototype.OnChange.call(this,value)
			this.OpenPreview(value,"explicit")
		},
		OpenPreview:function(value,is_explicit){
			var editor_widget=obj.editor_widget
			if(!editor_widget){return;}
			if(!editor_widget.m_is_special_document||!UI.HasFocus(obj.find_bar_edit)&&!is_explicit){return;}
			if(!this.items.length){return;}
			if(!this.items[value].name||this.items[value].is_dir){return;}
			var fn=IO.NormalizeFileName(this.items[value].name)
			if(editor_widget.file_name==fn){return;}
			if(!IO.FileExists(fn)){return;}
			if(editor_widget.m_file_name_before_preview){
				//clear preview first
				editor_widget.file_name=editor_widget.m_file_name_before_preview
				editor_widget.doc=undefined
				editor_widget.m_is_preview=0
				editor_widget.m_file_name_before_preview=undefined
				editor_widget.bin_preview=undefined;
			}
			if(!editor_widget.m_file_name_before_preview){
				editor_widget.m_file_name_before_preview=editor_widget.file_name
			}
			editor_widget.file_name=fn
			editor_widget.doc=undefined
			editor_widget.m_is_special_document=1
			editor_widget.m_is_preview=1
			editor_widget.bin_preview=undefined;
			//UI.InvalidateCurrentFrame()
			UI.Refresh()
		},
		item_template:{
			object_type:W.FileItem,
			owner:obj,
		},items:files})
	if(first_time){
		obj.file_list.OpenPreview(0,"explicit")
	}
	//find bar shadow
	UI.PushCliprect(obj.x,obj.y+obj.h_find_bar,obj.w,obj.h-obj.h_find_bar)
	UI.RoundRect({
		x:obj.x-obj.find_bar_shadow_size, y:obj.y+obj.h_find_bar-obj.find_bar_shadow_size, w:obj.w+2*obj.find_bar_shadow_size, h:obj.find_bar_shadow_size*2,
		round:obj.find_bar_shadow_size,
		border_width:-obj.find_bar_shadow_size,
		color:obj.find_bar_shadow_color})
	UI.PopCliprect()
	UI.End()
	if(UI.enable_timing){
		UI.TimingEvent("leaving FileBrowserPage");
	}
	return obj
};

UI.ExplicitFileOpen=function(){
	UI.UpdateNewDocumentSearchPath();
	//var tab_frontmost=UI.GetFrontMostEditorTab();
	//if(!tab_frontmost||!tab_frontmost.is_preview_window){
	//	var tab_preview=UI.NewCodeEditorTab();
	//	tab_preview.is_preview_window=1;
	//	tab_preview.title="Preview"
	//}
	UI.OpenUtilTab('file_browser')
	UI.Refresh()
}

UI.g_util_tab_openers={};
UI.FindUtilTab=function(util_type,do_settab){
	for(var i=0;i<UI.g_all_document_windows.length;i++){
		if(UI.g_all_document_windows[i].util_type==util_type){
			if(do_settab){
				UI.top.app.document_area.SetTab(i)
			}
			return UI.g_all_document_windows[i];
		}
	}
	return undefined;
}
UI.OpenUtilTab=function(util_type,is_quiet){
	var layout=UI.m_ui_metadata["<layout>"];
	layout.m_is_maximized=0;
	var ret=UI.FindUtilTab(util_type,is_quiet?0:1);
	if(ret){
		return ret;
	}
	var f=UI.g_util_tab_openers[util_type];
	if(f){
		var tab0=undefined;
		if(is_quiet){
			tab0=UI.g_all_document_windows[UI.top.app.document_area.current_tab_id||0];
		}
		var ret=f();
		ret.util_type=util_type;
		if(is_quiet){
			if(tab0){
				UI.top.app.document_area.SetTab(tab0.__global_tab_id)
			}
		}
		UI.Refresh();
		return ret;
	}else{
		return undefined;
	}
};

UI.RegisterUtilType=function(util_type,f){
	UI.g_util_tab_openers[util_type]=f;
};

UI.GetFrontMostEditorTab=function(){
	var tab_frontmost=undefined;
	for(var i=0;i<UI.g_all_document_windows.length;i++){
		var item_i=UI.g_all_document_windows[i];
		var name=(item_i.area_name||"doc_default");
		if(name.length<4||name.substr(0,4)!='doc_'){
			continue;
		}
		if(!tab_frontmost||(tab_frontmost.z_order||0)<(item_i.z_order||0)){
			tab_frontmost=item_i;
		}
		item_i.__global_tab_id=i;
	}
	return tab_frontmost;
};

UI.RegisterUtilType("file_browser",function(){return UI.NewTab({
	title:UI._("Files"),
	area_name:"h_tools",
	body:function(){
		//frontmost doc
		UI.context_parent.body=this.util_widget;
		var tab_frontmost=UI.GetFrontMostEditorTab();
		var had_body=!!this.util_widget;
		var body=W.FileBrowserPage('body',{
			'anchor':'parent','anchor_align':'fill','anchor_valign':'fill',
			'editor_widget':tab_frontmost&&tab_frontmost.main_widget,
			'activated':this==UI.top.app.document_area.active_tab,
			'x':0,'y':0});
		this.util_widget=body;
		if(UI.TestOption("auto_hide_filetab",0)&&had_body&&!(this==UI.top.app.document_area.active_tab)){
			UI.m_invalid_util_tabs.push(this.__global_tab_id);
		}
		return body;
	},
	NeedRendering:function(){
		if(this.util_widget){
			return this==UI.top.app.document_area.active_tab;
		}else{
			return 1;
		}
	},
	Save:function(){},
	SaveMetaData:function(){},
	OnDestroy:function(){},
})});

UI.DrawPrevNextAllButtons=function(obj,x,y, menu,stext,tooltips,fprev,fall,fnext){
	if(obj.m_prev_next_button_drawn!=UI.m_frame_tick){
		obj.m_prev_next_button_drawn=UI.m_frame_tick;
	}else{
		return;
	}
	menu.AddButtonRow({text:stext},[
		{key:"SHIFT+CTRL+D",text:"edit_up",icon:"上",tooltip:'Prev - SHIFT+CTRL+D',action:fprev},
		{key:"ALT+A",text:"edit_all",icon:"换",tooltip:'All - ALT+A',action:fall},
		{key:"CTRL+D",text:"edit_down",icon:"下",tooltip:'Next - CTRL+D',action:fnext}])
	if(!obj.doc.m_hide_prev_next_buttons){
		var sz_button=obj.autoedit_button_size;
		var padding=obj.autoedit_button_padding;
		var x_button_box=x-sz_button-padding*2;
		var y_button_box=y-sz_button*1.5-padding;
		var w_button_box=sz_button+padding*2;
		var h_button_box=sz_button*3+padding*2;
		UI.RoundRect({
			x:x_button_box-obj.accands_shadow_size, y:y_button_box, 
			w:w_button_box+obj.accands_shadow_size*2, h:h_button_box+obj.accands_shadow_size,
			round:obj.accands_shadow_size,
			border_width:-obj.accands_shadow_size,
			color:obj.accands_shadow_color})
		UI.RoundRect({
			x:x_button_box, y:y_button_box,
			w:w_button_box, h:h_button_box,
			border_width:obj.accands_border_width,
			border_color:obj.accands_border_color,
			round:obj.accands_round,
			color:obj.accands_bgcolor})
		//do the three buttons
		W.Button("button_edit_up",{style:UI.default_styles.check_button,
			x:x_button_box+padding,y:y_button_box+sz_button*0+padding,
			w:sz_button,h:sz_button,
			font:UI.icon_font_20,text:"上",tooltip:tooltips[0]+' - '+UI.LocalizeKeyName(UI.TranslateHotkey('SHIFT+CTRL+D')),
			tooltip_placement:'right',
			OnClick:fprev})
		W.Button("button_edit_all",{style:UI.default_styles.check_button,
			x:x_button_box+padding,y:y_button_box+sz_button*1+padding,
			w:sz_button,h:sz_button,
			font:UI.icon_font_20,text:"换",tooltip:tooltips[1]+' - '+UI.LocalizeKeyName(UI.TranslateHotkey('ALT+A')),
			tooltip_placement:'right',
			OnClick:fall})
		W.Button("button_edit_down",{style:UI.default_styles.check_button,
			x:x_button_box+padding,y:y_button_box+sz_button*2+padding,
			w:sz_button,h:sz_button,
			font:UI.icon_font_20,text:"下",tooltip:tooltips[2]+' - '+UI.LocalizeKeyName(UI.TranslateHotkey('CTRL+D')),
			tooltip_placement:'right',
			OnClick:fnext})
	}
}

UI.ED_GetFileLanguage=function(fn){
	var s_ext=UI.GetFileNameExtension(fn)
	var loaded_metadata=(UI.m_ui_metadata[fn]||{})
	var language_id=(loaded_metadata.m_language_id||Language.GetNameByExt(s_ext))
	return Language.GetDescObjectByName(language_id)
}

UI.ED_ParseMore_callback=function(fn){
	var s_ext=UI.GetFileNameExtension(fn)
	var loaded_metadata=(UI.m_ui_metadata[fn]||{})
	var language_id=(loaded_metadata.m_language_id||Language.GetNameByExt(s_ext))
	return Language.GetDescObjectByName(language_id);
	//var ret=Language.GetDescObjectByName(language_id)
	//var fn_h_to_c=undefined;
	//if(s_ext=="h"||s_ext=="hpp"){
	//	var fn_main=UI.GetMainFileName(fn);
	//	var exts=[".c",".cpp",".cxx",".cc",".C",".m",".cu"]
	//	for(var i=0;i<exts.length;i++){
	//		var fn_c=UI.SearchIncludeFileShallow(fn,fn_main+exts[i])
	//		if(fn_c&&fn_c!='<dangling>'&&fn_c!='<deep>'){
	//			fn_h_to_c=fn_c;
	//			break;
	//		}
	//	}
	//}
	//return {options:ret,fn_h_to_c:fn_h_to_c};
}

UI.SearchIncludeFileShallow=function(fn_base,fn_include){
	//console.log('UI.SearchIncludeFile',fn_base,fn_include);
	if(UI.Platform.ARCH=="win32"||UI.Platform.ARCH=="win64"){
		fn_include=fn_include.toLowerCase().replace(/\\/g,"/")
	}
	if(fn_include.indexOf('js_module@')==0){
		fn_include=fn_include.substr(10);
		//npm module search
		var spath_repo=DetectRepository(fn_base)
		if(spath_repo){
			var fn=spath_repo+"/node_modules/"+fn_include+"/index.js";
			if(IO.FileExists(fn)){
				return fn;
			}
		}
		var spath=undefined;
		if(UI.Platform.ARCH=="win32"||UI.Platform.ARCH=="win64"){
			spath=IO.ProcessUnixFileName("%appdata%/npm");
		}else{
			spath="/usr/lib";
		}
		var fn=spath+"/node_modules/"+fn_include+"/index.js";
		if(IO.FileExists(fn)){
			return fn;
		}
		return '';
	}
	var fn_include_length=fn_include.length;
	//base path
	var spath=UI.GetPathFromFilename(fn_base)
	var fn=(spath+"/"+fn_include);
	if(IO.FileExists(fn)){return fn;}
	//git
	DetectRepository(fn_base)
	var spath_repo=g_repo_from_file[fn_base]
	if(spath_repo){
		var repo=g_repo_list[spath_repo];
		if(repo&&repo.is_parsing){
			return '<dangling>';
		}
		if(repo){
			var files=repo.files;
			for(var i=0;i<files.length;i++){
				var fn_i=files[i]
				if(UI.Platform.ARCH=="win32"||UI.Platform.ARCH=="win64"){
					fn_i=fn_i.toLowerCase().replace(/\\/g,"/")
				}
				if(fn_i.length<fn_include_length){continue;}
				if(fn_i.substr(fn_i.length-fn_include_length)==fn_include&&IO.FileExists(fn_i)){
					return fn_i
				}
			}
		}
	}
	return '<deep>';
};

UI.SearchIncludeFile=function(fn_base,fn_include){
	var fn_found=UI.SearchIncludeFileShallow(fn_base,fn_include);
	if(fn_found=='<dangling>'||fn_found=='<deep>'){
		PrepareAPEM();
	}
	fn_found=UI.g_deep_search_cache[fn_include];
	if(fn_found==undefined){
		//all paths ever mentioned
		fn_found=null;
		var paths=UI.g_all_paths_ever_mentioned;
		for(var i=0;i<paths.length;i++){
			var fn=paths[i]+'/'+fn_include;
			if(IO.FileExists(fn)){
				fn_found=fn;
				break;
			}
		}
		if(fn_found!=undefined){
			UI.g_deep_search_cache[fn_include]=fn_found;
		}
	}
	return fn_found;
};

var MAX_PARSABLE_FCALL=4096
var finvoke_find=function(mode,s_force_needle){
	var obj=this;
	obj.show_find_bar=mode;
	//obj.m_sel0_before_find=obj.doc.sel0.ccnt
	//obj.m_sel1_before_find=obj.doc.sel1.ccnt
	if(s_force_needle!=undefined){
		UI.m_ui_metadata["<find_state>"].m_current_needle=s_force_needle;
	}else{
		var sel=obj.doc.GetSelection()
		if(sel[0]<sel[1]&&obj.doc.GetLC(sel[0])[0]==obj.doc.GetLC(sel[1])[0]){
			UI.m_ui_metadata["<find_state>"].m_current_needle=obj.doc.ed.GetText(sel[0],sel[1]-sel[0])
			if(UI.m_ui_metadata["<find_state>"].m_find_flags&UI.SEARCH_FLAG_REGEXP){
				UI.m_ui_metadata["<find_state>"].m_current_needle=RegexpEscape(UI.m_ui_metadata["<find_state>"].m_current_needle)
			}
		}
	}
	obj.DismissNotification('find_result')
	obj.DestroyFindingContext()
	UI.Refresh()
};
var finvoke_goto=function(mode){
	var obj=this;
	var sel=obj.doc.GetSelection()
	obj.show_find_bar=mode
	//obj.m_sel0_before_find=obj.doc.sel0.ccnt
	//obj.m_sel1_before_find=obj.doc.sel1.ccnt
	//if(sel[0]<sel[1]){
	//	UI.m_ui_metadata["<find_state>"].m_current_needle=obj.doc.ed.GetText(sel[0],sel[1]-sel[0])
	//}
	//UI.m_ui_metadata["<find_state>"].m_current_needle=""
	UI.Refresh()
}
var g_regexp_folding_templates=['[ \t]+','[0-9]+','[0-9a-fA-F]+','[.0-9efEF+-]+','[0-9a-zA-Z$_]+','["][^"]*["]',"['][^'']*[']"].map(
	function(a){
		return {regexp:new RegExp("^"+a+"$"),starget:"("+a+")"};
	}
);

var RenderACCands=function(obj,w_obj_area,h_obj_area){
	var doc=obj.doc;
	var acctx=doc.m_ac_context;
	var prt_msg_brief=undefined;
	var x_selected=undefined;
	if(doc.m_ac_context&&doc.m_ac_activated){
		var dii=acctx.GetDisplayItem(acctx.m_selection);
		var prt_msg_brief=acctx.m_brief_cache[dii.name];
		if(prt_msg_brief==undefined){
			var prt_msg_brief=null;
			if(dii.brief){
				var brief_ctx=UI.ED_ProcessHelp(dii.brief,obj.accands_styles2,null,obj.accands_w_brief);
				prt_msg_brief={
					prt:UI.ED_FormatRichText(
						Language.GetHyphenator(UI.m_ui_language),
						brief_ctx.m_text,4,obj.accands_w_brief,obj.accands_styles2,brief_ctx.m_objs),
					text:brief_ctx.m_text,
				};
			}else{
				var briefs=UI.ED_QueryBriefsByID(doc,dii.name);
				if(briefs&&briefs.length){
					var a_msg_brief=[];
					var id_in_file=0;
					for(var i=0;i<briefs.length;i++){
						if(!i||briefs[i].file!=briefs[i-1].file){
							a_msg_brief.push(
								UI.Format('In @1:',UI.ED_RichTextCommandChar(UI.RICHTEXT_COMMAND_SET_STYLE+1)+UI.GetSmartTabName(briefs[i].file)+UI.ED_RichTextCommandChar(UI.RICHTEXT_COMMAND_SET_STYLE+0)),
								'\n');
							id_in_file=0;
						}
						a_msg_brief.push('   ')
						id_in_file++;
						if(id_in_file>1||i+1<briefs.length&&briefs[i+1].file==briefs[i].file){
							a_msg_brief.push(
								UI.ED_RichTextCommandChar(UI.RICHTEXT_COMMAND_SET_STYLE+1),
								id_in_file<=20?String.fromCharCode(0x245f+id_in_file):id_in_file.toString()+'.',' ',
								UI.ED_RichTextCommandChar(UI.RICHTEXT_COMMAND_SET_STYLE+0))
						}
						a_msg_brief.push(UI.ED_RichTextCommandChar(UI.RICHTEXT_COMMAND_INDENT_HERE),briefs[i].brief,'\n');
					}
					var s_brief_text=a_msg_brief.join('');
					prt_msg_brief={
						prt:UI.ED_FormatRichText(
							Language.GetHyphenator(UI.m_ui_language),
							s_brief_text,4,obj.accands_w_brief,obj.accands_styles),
						text:s_brief_text,
					};
				}
			}
			acctx.m_brief_cache[dii.name]=prt_msg_brief;
		}
	}
	var ac_w_needed=0
	while(acctx.m_display_items.length<acctx.m_scroll_i){
		acctx.GetDisplayItem(acctx.m_display_items.length)
	}
	for(var i=acctx.m_scroll_i;i<acctx.m_n_cands&&i<acctx.m_scroll_i+obj.accands_n_shown;i++){
		ac_w_needed+=acctx.GetDisplayItem(i).w+obj.accands_padding
	}
	var ed_caret=doc.GetIMECaretXY();
	var x_caret=(ed_caret.x-doc.visible_scroll_x);
	var y_caret=(ed_caret.y-doc.visible_scroll_y);
	x_caret-=UI.MeasureText(doc.font,acctx.m_accands.s_prefix).w
	var hc=UI.GetCharacterHeight(doc.font)
	var x_accands=Math.max(Math.min(x_caret,obj.x+w_obj_area-ac_w_needed-doc.x),0)
	var y_accands=y_caret+hc
	if(doc.y+y_accands+obj.accands_h>obj.y+h_obj_area){
		y_accands=y_caret-obj.h_accands
	}
	x_accands+=doc.x
	y_accands+=doc.y
	var ac_anim_node=W.AnimationNode("accands_scrolling",{
		scroll_x:acctx.GetDisplayItem(acctx.m_scroll_i).x,
		current_w:ac_w_needed,
	})
	var ac_scroll_x=ac_anim_node.scroll_x
	var w_accands=ac_anim_node.current_w
	UI.RoundRect({
		x:x_accands-obj.accands_shadow_size, y:y_accands, 
		w:w_accands+obj.accands_shadow_size*2, h:obj.h_accands+obj.accands_shadow_size,
		round:obj.accands_shadow_size,
		border_width:-obj.accands_shadow_size,
		color:obj.accands_shadow_color})
	UI.RoundRect({
		x:x_accands, y:y_accands,
		w:w_accands, h:obj.h_accands,
		border_width:obj.accands_border_width,
		border_color:obj.accands_border_color,
		round:obj.accands_round,
		color:obj.accands_bgcolor})
	//draw the candidates
	UI.PushCliprect(x_accands, y_accands, w_accands, obj.h_accands)
	var hc_accands=UI.GetCharacterHeight(obj.accands_font)
	var y_accands_text=y_accands+(obj.h_accands-hc_accands)*0.5
	var ac_id0=acctx.IDFromX(ac_scroll_x)
	var ac_id1=acctx.IDFromX(ac_scroll_x+w_accands)
	for(var i=ac_id0;i<=ac_id1;i++){
		var dii=acctx.GetDisplayItem(i)
		var selected=(doc.m_ac_context&&doc.m_ac_activated&&i==acctx.m_selection)
		var num_id=(i-acctx.m_scroll_i+11)%10
		var w_hint_char=UI.GetCharacterAdvance(obj.accands_id_font,48+num_id)
		var x_item=x_accands+dii.x-ac_scroll_x+obj.accands_left_padding
		//x, w, name
		if(selected){
			UI.RoundRect({
				x:x_item-w_hint_char-obj.accands_sel_padding,
				y:y_accands_text-obj.accands_sel_padding,
				w:dii.w+obj.accands_sel_padding*2+w_hint_char,h:hc_accands+obj.accands_sel_padding*2,
				color:obj.accands_sel_bgcolor,
			})
			x_selected=x_item;
		}
		W.Text("",{x:x_item,y:y_accands_text,
			font:obj.accands_font,text:dii.name,
			color:selected?obj.accands_text_sel_color:obj.accands_text_color})
		//coulddo: a shaking arrow with a big "TAB"
		UI.DrawChar(obj.accands_id_font,
			x_item-obj.accands_sel_padding*0.5-w_hint_char,y_accands_text,
			selected?obj.accands_text_sel_color:obj.accands_text_color,48+num_id)
		if(doc.m_ac_context&&doc.m_ac_activated){
			doc.AddTransientHotkey(String.fromCharCode(48+num_id),doc.ConfirmAC.bind(doc,i))
		}
	}
	UI.PopCliprect()
	//render the documentation part
	if(prt_msg_brief&&x_selected!=undefined){
		var y_brief=y_accands+obj.h_accands+obj.accands_sel_padding;
		var w_brief=prt_msg_brief.prt.m_w_line+obj.accands_sel_padding*4;
		var h_brief=prt_msg_brief.prt.m_h_text+obj.accands_sel_padding*4;
		UI.RoundRect({
			x:x_selected-obj.accands_shadow_size, y:y_brief,
			w:w_brief+obj.accands_shadow_size*2, h:h_brief+obj.accands_shadow_size,
			round:obj.accands_shadow_size,
			border_width:-obj.accands_shadow_size,
			color:obj.accands_shadow_color})
		UI.RoundRect({
			x:x_selected, y:y_brief,
			w:w_brief, h:h_brief,
			border_width:obj.accands_border_width,
			border_color:obj.accands_border_color,
			round:obj.accands_round,
			color:obj.accands_bgcolor})
		UI.ED_RenderRichText(prt_msg_brief.prt,prt_msg_brief.text,
			x_selected+obj.accands_sel_padding*2,y_brief+obj.accands_sel_padding*2)
	}
};

UI.RegisterEditorPlugin(function(){
	if(this.plugin_class!="code_editor"){return;}
	var fupdate_tab=function(){
		if(this.m_owner){
			this.m_owner.m_is_rendering_good=0;
		}
	};
	this.AddEventHandler('change',fupdate_tab)
	this.AddEventHandler('selectionChange',fupdate_tab)
})
W.CodeEditor=function(id,attrs){
	if(UI.enable_timing){
		UI.TimingEvent("enter CodeEditor "+attrs.file_name);
	}
	var obj=UI.StdWidget(id,attrs,"code_editor",W.CodeEditorWidget_prototype);
	if(obj.m_is_special_document&&obj.doc&&UI.HasFocus(obj.doc)){
		if(obj.m_file_name_before_preview){
			obj.file_name=obj.m_file_name_before_preview
			obj.doc=undefined
			obj.m_is_preview=0
			obj.m_file_name_before_preview=undefined
		}
	}
	if(obj.doc){
		var style=UI.default_styles.code_editor.editor_style;
		if(style.__proto__!=W.CodeEditor_prototype){
			style.__proto__=W.CodeEditor_prototype;
		}
		if(obj.doc.__proto__!=style){
			obj.doc.__proto__=style;
		}
	}
	//if(!obj.m_language_id){
	//	var s_ext=UI.GetFileNameExtension(obj.file_name||"")
	//	obj.m_language_id=Language.GetNameByExt(s_ext)
	//}
	var w_obj_area=obj.w
	var h_obj_area=obj.h
	//prevent m_current_file_list leaks
	UI.m_current_file_list=undefined
	UI.Begin(obj)
		//main code area
		obj.h_obj_area=h_obj_area
		var doc=obj.doc
		var prev_h_top_hint=(obj.h_top_hint||0),h_top_hint=0,w_line_numbers=0,w_scrolling_area=0,y_top_hint_scroll=0;
		var h_scrolling_area=h_obj_area
		var h_top_find=0
		var editor_style=obj.editor_style
		var top_hint_bbs=[]
		var current_find_context=obj.m_current_find_context
		var ytot=undefined;
		var w_right_shadow=undefined;
		var right_overlay_drawn=0;
		var y_bottom_shadow=undefined;
		var desc_x_scroll_bar=undefined;
		//&&!(doc&&doc.notebook_owner)
		var show_minimap=(UI.TestOption("show_minimap")&&!obj.disable_minimap&&!(!obj.m_edit_lock&&obj.show_find_bar));
		var w_minimap=obj.w_minimap;
		if(show_minimap){
			show_minimap=1;
			if(UI.TestOption("auto_hide_minimap")&&doc){
				var show_minimap_target=0;
				var show_minimap_current=(obj.minimap_animation?obj.minimap_animation.show_minimap:0)
				if(!doc.m_scroll_samples){
					doc.m_scroll_samples=[];
				}
				var minimap_interval=(show_minimap_current>0?obj.auto_minimap_ending_interval:obj.auto_minimap_starting_interval);
				while(doc.m_scroll_samples.length>0&&
				Duktape.__ui_seconds_between_ticks(doc.m_scroll_samples[0],UI.m_frame_tick)>minimap_interval){
					doc.m_scroll_samples.shift()
				}
				if(doc.m_scroll_y_old!=undefined&&doc.m_scroll_y_old!=doc.scroll_y){
					doc.m_scroll_samples.push(UI.m_frame_tick)
				}
				if(doc.m_scroll_samples.length>=(show_minimap_current>0?obj.auto_minimap_ending_threshold:obj.auto_minimap_starting_threshold)){
					show_minimap_target=1;
				}else{
					show_minimap_target=0;
				}
				if(show_minimap_target==1&&doc.m_scroll_samples.length>0&&!doc.m_has_refresh_timeout){
					doc.m_has_refresh_timeout=1;
					UI.setTimeout(function(){
						doc.m_has_refresh_timeout=0;
						UI.RefreshAllTabs()
					},((minimap_interval-Duktape.__ui_seconds_between_ticks(doc.m_scroll_samples[0],UI.m_frame_tick))*1000+100)|0)
				}
				doc.m_scroll_y_old=doc.scroll_y;
				//if(doc.m_last_mousemove&&doc.m_last_mousemove.x>w_obj_area-(obj.w_scroll_bar+w_minimap+obj.padding)){
				//	show_minimap_target=1;
				//}
				var anim_minimap=W.AnimationNode("minimap_animation",{
					transition_dt:obj.auto_minimap_transition_dt,
					show_minimap:show_minimap_target})
				show_minimap=anim_minimap.show_minimap;
			}
		}
		w_minimap*=show_minimap;
		var show_at_scrollbar_find_minimap=UI.TestOption("show_at_scrollbar_find_minimap")
		var all_docvars=[];
		if(doc){
			//scrolling and stuff
			if(doc.h!=undefined){
				doc.AutoScroll("bound")
			}
			var ccnt_tot=doc.ed.GetTextSize()
			var ytot=doc.ed.XYFromCcnt(ccnt_tot).y+doc.ed.GetCharacterHeightAt(ccnt_tot);
			if(h_obj_area<ytot&&!obj.m_is_preview){
				w_scrolling_area=obj.w_scroll_bar
				if(show_minimap){
					w_scrolling_area+=w_minimap+obj.padding
				}
			}
			if(w_obj_area<=w_line_numbers+w_scrolling_area){
				w_scrolling_area=0
				if(w_obj_area<=w_line_numbers){
					w_line_numbers=w_obj_area*0.5
				}
			}
			//top hint in a separate area
			if(UI.TestOption("show_top_hint")&&!obj.show_find_bar&&!obj.disable_top_hint){
				var top_hints=[];
				//var top_hints_indent=[];
				var rendering_ccnt0=doc.SeekXY(doc.scroll_x,doc.scroll_y)
				var ccnt=doc.GetEnhancedHome(doc.sel1.ccnt)
				//prev_h_top_hint
				var key_decl_check_frontier=0;
				var i_tot=0;
				var show_var_hint=UI.TestOption("show_var_hint");
				for(;;){
					var ccnti=ccnt
					var fol_ret=doc.FindOuterLevel(ccnti);
					ccnt=fol_ret.ccnt_editor;
					if(ccnt<0||ccnt>=ccnti){break}
					if(show_var_hint){
						var docvars=UI.ED_QueryDocVarByScope(doc,fol_ret.ccnt_parser);
						if(docvars&&docvars.length){
							all_docvars=all_docvars.concat(docvars);
						}
					}
					var ccnt_push=ccnt;
					if(doc.ed.GetUtf8CharNeighborhood(ccnt_push)[1]==0x7B){
						//lonely { case
						var ccnt_ehome=doc.ed.MoveToBoundary(ccnt_push,-1,"space");
						if(doc.ed.GetUtf8CharNeighborhood(ccnt_ehome)[0]==10&&ccnt_ehome>0){
							//\n space {, guilty
							ccnt_push=ccnt_ehome-1;
						}
					}
					if(ccnt_push<rendering_ccnt0&&(!top_hints.n||top_hints[top_hints.length]>ccnt_push)){
						//var ilevel=doc.GetIndentLevel(ccnt);
						//remove the under-indented: #endif and stuff in C
						//while(top_hints_indent.length&&top_hints_indent[top_hints_indent.length-1]<ilevel){
						//	top_hints.pop()
						//	top_hints_indent.pop()
						//}
						if(top_hints.length>=obj.top_hint_max_lines){
							top_hints.pop()
							if(key_decl_check_frontier>top_hints.length){
								key_decl_check_frontier=top_hints.length;
							}
						}
						top_hints.push(ccnt_push)
						//top_hints_indent.push(ilevel)
					}
					if(i_tot>=obj.top_hint_max_levels){
						break;
					}
					i_tot++;
					if(top_hints.length>=obj.top_hint_max_lines){
						var has_kd=0;
						for(;key_decl_check_frontier<top_hints.length;key_decl_check_frontier++){
							var line_i=doc.GetLC(top_hints[key_decl_check_frontier])[0]
							var line_ccnts_i=doc.SeekAllLinesBetween(line_i,line_i+2)
							if(UI.ED_HasKeyDeclInCcntRange(doc,line_ccnts_i[0],line_ccnts_i[1])){
								has_kd=1;
								break
							}
						}
						if(has_kd){
							break;
						}
					}
				}
				if(top_hints.length){
					//convert to bbs
					var top_hint_inv=[];
					for(var i=top_hints.length-1;i>=0;i--){
						var ccnt=top_hints[i];
						top_hint_inv.push(ccnt);
					}
					top_hints=undefined;
					var renderer=doc.GetRenderer();
					var bk_m_enable_hidden=renderer.m_enable_hidden;
					renderer.m_enable_hidden=0;
					var line_xys=doc.ed.GetXYEnMasse(top_hint_inv)
					var hc=UI.GetCharacterHeight(doc.font)
					var eps=hc/16;
					var cur_bb_y0=line_xys[1];
					var cur_bb_y1=cur_bb_y0+hc;
					//print(doc.sel1.ccnt,'->',JSON.stringify(top_hints),JSON.stringify(line_xys))
					h_top_hint=hc
					for(var i=2;i<line_xys.length;i+=2){
						var y=line_xys[i+1];
						if(Math.abs(y-cur_bb_y1)<eps){
							cur_bb_y1=y+hc;
							h_top_hint+=hc
						}else if(y<cur_bb_y1){
							continue
						}else{
							top_hint_bbs.push(cur_bb_y0,cur_bb_y1)
							cur_bb_y0=y;
							cur_bb_y1=y+hc;
							h_top_hint+=hc
						}
					}
					if(h_top_hint>hc*obj.top_hint_max_lines-eps){
						y_top_hint_scroll=hc*obj.top_hint_max_lines-h_top_hint;
						h_top_hint=hc*obj.top_hint_max_lines;
					}
					top_hint_bbs.push(cur_bb_y0,cur_bb_y1)
					//renderer.m_enable_hidden=1;
					renderer.m_enable_hidden=bk_m_enable_hidden;
				}
			}else{
				h_top_hint=0
			}
			//if(UI.nd_captured){
			//	h_top_hint=prev_h_top_hint;//don't change it while scrolling
			//}
			doc.h_top_hint_real=h_top_hint;
			if(Math.abs(h_top_hint-prev_h_top_hint)>4&&h_top_hint>0&&!UI.nd_captured){
				h_top_hint=(h_top_hint*0.5+prev_h_top_hint*0.5);
				UI.Refresh()
			}
			obj.h_top_hint=h_top_hint
			doc.h_top_hint=h_top_hint
			//if(h_top_hint-prev_h_top_hint){
			//	if(doc.scrolling_animation){
			//		var anim=doc.scrolling_animation
			//		if(anim.transition_current_frame){anim.transition_current_frame.scroll_y+=h_top_hint-prev_h_top_hint;}
			//		if(anim.transition_frame0){anim.transition_frame0.scroll_y+=h_top_hint-prev_h_top_hint;}
			//		if(anim.transition_frame1){anim.transition_frame1.scroll_y+=h_top_hint-prev_h_top_hint;}
			//	}
			//	doc.scroll_y+=h_top_hint-prev_h_top_hint
			//	doc.h=h_obj_area-h_top_hint
			//	if(!UI.nd_captured){doc.AutoScroll("show");}
			//}
			//current line highlight
			var line_current=doc.GetLC(doc.sel1.ccnt)[0]
			var ed_caret=doc.GetCaretXY();
			//var line_ccnts=doc.SeekAllLinesBetween(line_current,line_current+2)
			doc.cur_line_hl.color=obj.color_cur_line_highlight;
			if(UI.TestOption("show_line_highlight")&&UI.nd_focus==doc&&!doc.read_only){
				doc.cur_line_p0.ccnt=doc.SeekXY(0,ed_caret.y);
				doc.cur_line_p1.ccnt=doc.SeekXY(1e17,ed_caret.y);
			}else{
				doc.cur_line_p0.ccnt=0;
				doc.cur_line_p1.ccnt=0;
			}
			var s_autofind_needle=undefined;
			if(!obj.show_find_bar){
				s_autofind_needle=UI.m_ui_metadata["<find_state>"].m_current_needle;
				var sel=doc.GetSelection();
				if(sel[1]-sel[0]<=GRACEFUL_WORD_SIZE){
					var sel0x=doc.ed.MoveToBoundary(sel[1],-1,"word_boundary_left");
					var sel1x=doc.ed.MoveToBoundary(sel[0],1,"word_boundary_right");
					if(sel0x==sel[0]&&sel1x==sel[1]){
						//sel auto highlight
						s_autofind_needle=doc.ed.GetText(sel[0],sel[1]-sel[0])
					}
				}
			}
			//find highlight
			if(!obj.show_find_bar&&s_autofind_needle&&!obj.m_hide_find_highlight){
				//repeat the animation to get the correct scrolling information
				UI.Begin(doc)
					//alway bound the scroll to valid ranges
					var sx0=doc.scroll_x;
					var sy0=doc.scroll_y;
					if(!(sx0==doc.scroll_x&&sy0==doc.scroll_y)){
						obj.scrolling_animation=undefined;
					}
					var anim=W.AnimationNode("scrolling_animation",{transition_dt:doc.scroll_transition_dt,
						scroll_x:doc.scroll_x,
						scroll_y:doc.scroll_y})
				UI.End("temp")
				doc.visible_scroll_x=anim.scroll_x
				doc.visible_scroll_y=anim.scroll_y
				var scroll_x=doc.visible_scroll_x;
				var scroll_y=doc.visible_scroll_y;
				var area_w=doc.w
				var area_h=doc.h
				var y0_rendering=scroll_y
				var y1_rendering=scroll_y+area_h
				if(show_minimap){
					var y_scrolling_area=obj.y
					var effective_scroll_y=doc.visible_scroll_y
					var sbar_value=Math.max(Math.min(effective_scroll_y/(ytot-h_scrolling_area),1),0)
					var minimap_scale=obj.minimap_font_height/UI.GetFontHeight(editor_style.font)
					var h_minimap=h_scrolling_area/minimap_scale
					var scroll_y_minimap=sbar_value*Math.max(ytot-h_minimap,0)
					if(y0_rendering>scroll_y_minimap){y0_rendering=scroll_y_minimap;}
					if(y1_rendering<scroll_y_minimap+h_minimap){y1_rendering=scroll_y_minimap+h_minimap;}
				}
				var rendering_ccnt0=doc.SeekXY(scroll_x,y0_rendering)
				var rendering_ccnt1=doc.SeekXY(scroll_x+area_w,y1_rendering)
				var s_bk=UI.m_ui_metadata["<find_state>"].m_current_needle;
				var need_new_ctx=0;
				if(obj.m_current_find_context&&
				show_at_scrollbar_find_minimap&&
				!obj.m_changed_after_find&&
				s_autofind_needle==obj.m_current_find_context.m_needle&&
				!(obj.m_current_find_context.m_flags&UI.SEARCH_FLAG_FUZZY)){
					if(!UI.IsSearchFrontierCompleted(obj.m_current_find_context.m_backward_frontier)&&UI.GetSearchFrontierCcnt(obj.m_current_find_context.m_backward_frontier)>rendering_ccnt0){
						//the previous context went out of range
						need_new_ctx=1;
					}else if(!UI.IsSearchFrontierCompleted(obj.m_current_find_context.m_forward_frontier)&&UI.GetSearchFrontierCcnt(obj.m_current_find_context.m_forward_frontier)<rendering_ccnt1){
						//the previous context went out of range
						need_new_ctx=1;
					}else{
						//keep the current context
					}
				}else{
					need_new_ctx=1;
				}
				if(show_at_scrollbar_find_minimap){
					rendering_ccnt0=0;
					rendering_ccnt1=doc.ed.GetTextSize();
				}
				if(need_new_ctx){
					obj.ResetFindingContext(s_autofind_needle,UI.m_ui_metadata["<find_state>"].m_find_flags, Math.min(Math.max(rendering_ccnt0,doc.SeekLC(doc.GetLC(doc.sel1.ccnt)[0],0)),rendering_ccnt1))
				}
				UI.m_ui_metadata["<find_state>"].m_current_needle=s_bk;
				current_find_context=obj.m_current_find_context
				//print(UI.GetSearchFrontierCcnt(current_find_context.m_backward_frontier),UI.GetSearchFrontierCcnt(current_find_context.m_forward_frontier),current_find_context.m_backward_frontier,current_find_context.m_forward_frontier,current_find_context.m_flags)
				if(current_find_context){
					if(!UI.IsSearchFrontierCompleted(current_find_context.m_backward_frontier)&&UI.GetSearchFrontierCcnt(current_find_context.m_backward_frontier)>rendering_ccnt0&&current_find_context.m_backward_matches.length<MAX_HIGHLIGHTED_MATCHES){
						current_find_context.m_backward_frontier=UI.ED_Search(doc.ed,current_find_context.m_backward_frontier,-1,current_find_context.m_needle,current_find_context.m_flags,65536,current_find_context.ReportMatchBackward.bind(current_find_context,doc),current_find_context)
						UI.Refresh()
					}
					if(!UI.IsSearchFrontierCompleted(current_find_context.m_forward_frontier)&&UI.GetSearchFrontierCcnt(current_find_context.m_forward_frontier)<rendering_ccnt1&&current_find_context.m_forward_matches.length<MAX_HIGHLIGHTED_MATCHES){
						current_find_context.m_forward_frontier=UI.ED_Search(doc.ed,current_find_context.m_forward_frontier,1,current_find_context.m_needle,current_find_context.m_flags,65536,current_find_context.ReportMatchForward.bind(current_find_context,doc),current_find_context);
						UI.Refresh()
					}
				}
			}
		}
		//hopefully '8' is the widest digit char
		var show_line_numbers=(UI.TestOption("show_line_numbers")&&!(doc&&doc.disable_line_numbers))
		if(show_line_numbers){
			var lmax=(doc?doc.GetLC(doc.ed.GetTextSize())[0]:0)+1
			w_line_numbers=Math.max(lmax.toString().length,3)*UI.GetCharacterAdvance(obj.line_number_font,56);
		}
		var is_find_mode_rendering=(!obj.m_edit_lock&&obj.show_find_bar&&current_find_context);
		var w_bookmark=UI.GetCharacterAdvance(obj.bookmark_font,56)+4
		w_line_numbers+=obj.padding+w_bookmark;
		if(is_find_mode_rendering){
			UI.RoundRect({color:obj.find_mode_bgcolor,x:obj.x,y:obj.y,w:w_obj_area,h:h_obj_area})
		}
		UI.RoundRect({color:obj.bgcolor,x:obj.x+w_obj_area-w_scrolling_area,y:obj.y,w:w_scrolling_area,h:h_obj_area})
		//if(obj.show_find_bar&&current_find_context){
		//	UI.RoundRect({color:obj.find_mode_bgcolor,x:obj.x,y:obj.y,w:w_obj_area,h:h_obj_area})
		//	UI.RoundRect({color:obj.bgcolor,x:obj.x+w_obj_area-w_scrolling_area,y:obj.y,w:w_scrolling_area,h:h_obj_area})
		//}else{
		//	//UI.RoundRect({color:obj.line_number_bgcolor,x:obj.x,y:obj.y,w:w_line_numbers,h:h_obj_area})
		//	//UI.RoundRect({color:obj.bgcolor,x:obj.x+w_line_numbers,y:obj.y,w:w_obj_area-w_line_numbers,h:h_obj_area})
		//}
		//loading progress
		if(doc&&doc.ed.hfile_loading){
			obj.CreateNotification({
				id:'loading_progress',
				icon:undefined,
				progress:doc.ed.hfile_loading.progress,
				text:UI._("Loading @1%...").replace('@1',(doc.ed.hfile_loading.progress*100).toFixed(0))},"quiet")
		}else{
			obj.DismissNotification('loading_progress')
		}
		//parsing progress
		var parsing_jobs=UI.ED_GetRemainingParsingJobs();
		if(doc&&!doc.notebook_owner&&parsing_jobs){
			var fn_next=UI.GetSmartTabName(parsing_jobs.fn_next);
			obj.CreateNotification({
				id:'parsing_progress',
				icon:undefined,
				text:UI.Format("Parsing @1, @2 files left...",fn_next,parsing_jobs.n)},"quiet")
		}else{
			obj.DismissNotification('parsing_progress')
		}
		if(doc){
			var renderer=doc.GetRenderer();
			renderer.m_virtual_diffs=undefined;
		}
		if(doc&&doc.m_enable_wrapping&&!obj.m_is_preview){
			var x_wrap_bar=w_line_numbers+obj.doc.displayed_wrap_width-obj.doc.visible_scroll_x+12;
			if(w_obj_area-w_scrolling_area-x_wrap_bar>0){
				w_right_shadow=x_wrap_bar;
			}
		}
		if(!is_find_mode_rendering){
			UI.RoundRect({color:obj.read_only?UI.default_styles.code_editor.line_number_bgcolor:UI.default_styles.code_editor.bgcolor,
				x:obj.x+w_line_numbers,
				y:obj.y,
				w:w_obj_area-w_line_numbers-w_scrolling_area,
				h:h_obj_area});
			if(w_right_shadow!=undefined){
				//try to draw the right "overlay" early
				var h_right_shadow=doc.h;
				UI.RoundRect({color:obj.find_mode_bgcolor,x:obj.x+w_right_shadow,y:obj.y,w:w_obj_area-w_scrolling_area-w_right_shadow,h:obj.h})
				right_overlay_drawn=1;
			}
		}
		if(doc&&doc.m_is_help_page_preview){
			W.HelpPage('help_page',{
				x:obj.x,y:obj.y,w:w_obj_area,h:h_obj_area,
				is_file_view:1,
				m_file_name:doc.m_file_name
			});
		}else if(doc&&obj.m_edit_lock){
			obj.__children.push(doc)
			UI.Begin(doc)
				var anim=W.AnimationNode("scrolling_animation",{transition_dt:doc.scroll_transition_dt,
					scroll_x:doc.scroll_x,
					scroll_y:doc.scroll_y})
			UI.End()
			doc.visible_scroll_x=anim.scroll_x
			doc.visible_scroll_y=anim.scroll_y
			//still render it, but without the caret or user interaction
			doc.x=obj.x+w_line_numbers+obj.padding
			doc.y=obj.y
			doc.w=w_obj_area-w_line_numbers-obj.padding-w_scrolling_area
			doc.h=h_obj_area
			doc.RenderWithLineNumbers(doc.visible_scroll_x,doc.visible_scroll_y,obj.x,obj.y,w_obj_area-w_scrolling_area,h_obj_area,0,1)
		}else if(obj.m_is_preview&&!doc&&(obj.bin_preview||UI.ED_GetFileLanguage(obj.file_name).is_binary)){
			W.BinaryEditor("bin_preview",{
				x:obj.x,y:obj.y,w:w_obj_area,h:h_obj_area,
				is_preview:1,file_name:obj.file_name,
			})
		}else{
			if(obj.show_find_bar&&doc&&doc.notebook_owner){
				obj.show_find_bar&=~UI.SEARCH_FLAG_GLOBAL;
			}
			if(obj.show_find_bar){
				h_top_find+=obj.h_find_bar
				obj.m_hide_find_highlight=0;
				obj.m_no_more_replace=0;
			}
			//individual lines, each with a box and a little shadow for separation
			var h_max_find_items_per_side=(h_obj_area-obj.h_find_bar)*obj.find_item_space_percentage*0.5
			var h_find_item_middle=h_obj_area-obj.h_find_bar-h_max_find_items_per_side*2
			//var find_ranges_back=undefined;
			//var find_ranges_forward=undefined;
			var find_item_scroll_x=undefined
			var w_document=w_obj_area-w_scrolling_area-w_line_numbers;
			var disclaimer_alpha=0.0;
			if(obj.show_find_bar&&current_find_context){
				obj.__children.push(doc)
				UI.Begin(doc)
					var anim=W.AnimationNode("scrolling_animation",{transition_dt:doc.scroll_transition_dt,
						scroll_x:doc.scroll_x,
						scroll_y:doc.scroll_y})
				UI.End()
				doc.visible_scroll_x=anim.scroll_x
				doc.visible_scroll_y=anim.scroll_y
			}else{
				//fhint and AC - compute the hint first
				if(doc){
					//function prototype hint
					var got_overlay_before=!!doc.ed.m_other_overlay;
					var fhctx=doc.m_fhint_ctx
					//fhint
					var s_fhint=fhctx&&fhctx.s_fhint;
					//auto-completion
					doc.ed.m_other_overlay=undefined
					if(!obj.show_find_bar&&doc.m_ac_context){
						var acctx=doc.m_ac_context;
						if(acctx.m_accands&&acctx.m_accands.m_common_prefix){
							doc.ed.m_other_overlay={'type':'AC','text':acctx.m_accands.m_common_prefix}
						}
						//else if(acctx.m_n_cands==1){
						//	//doc.ed.m_other_overlay always shows the 1st candidate?
						//	//need PPM weight calibration, and float weights
						//	//can't auto-calibrate - PPM always wins
						//	//tab should be strictly for common prefix? if we could guess the 1st candidate right...
						//	var s_name=acctx.m_accands.at(0).name
						//	doc.ed.m_other_overlay={'type':'AC','text':acctx.m_accands.m_common_prefix}
						//}
					}
					if(s_fhint){
						if(doc.ed.m_other_overlay){
							doc.ed.m_other_overlay.text=doc.ed.m_other_overlay.text+s_fhint
						}else{
							doc.ed.m_other_overlay={'type':'AC','text':s_fhint}
						}
					}
					var s_notification=(fhctx&&fhctx.s_notification);
					if(s_notification){
						if(UI.TestOption("function_info_at_the_cursor")){
							obj.DismissNotification('function_proto')
						}else{
							obj.CreateNotification({id:'function_proto',text:s_notification},"quiet")
						}
					}else if(all_docvars.length){
						var msg_docvar=[];
						for(var i=0;i<all_docvars.length;i+=2){
							msg_docvar.push()
							msg_docvar.push(
								UI.ED_RichTextCommandChar(UI.RICHTEXT_COMMAND_SET_STYLE+1),
								all_docvars[i],
								UI.ED_RichTextCommandChar(UI.RICHTEXT_COMMAND_SET_STYLE+11),
								'  ',
								UI.ED_RichTextCommandChar(UI.RICHTEXT_COMMAND_INDENT_HERE),
								UI.ED_RichTextCommandChar(UI.RICHTEXT_COMMAND_SET_STYLE+0),
								all_docvars[i+1],'\n')
						}
						obj.CreateNotification({id:'function_proto',text:msg_docvar.join('')},"quiet")
					}else{
						obj.DismissNotification('function_proto')
					}
					//if(got_overlay_before&&!doc.ed.m_other_overlay){
					//	UI.InvalidateCurrentFrame()
					//	UI.Refresh()
					//}
				}
				//if(!doc){
				//	if(obj.file_name=="*res/misc/example.cpp"){
				//		UI.InvalidateCurrentFrame();
				//	}
				//}
				if(!doc){
					doc=UI.OpenCodeEditorDocument(obj.file_name,obj.m_is_preview);
					obj.m_tabswitch_count=((obj.file_name&&UI.m_ui_metadata[obj.file_name]||{}).m_tabswitch_count||{});
					obj.doc=doc;
					if(doc.m_is_help_page_preview){
						UI.InvalidateCurrentFrame();
						UI.Refresh();
					}
				}
				UI.Keep("doc",{});
				var was_bound_elsewhere=0;
				if(doc.owner!=obj){
					was_bound_elsewhere=1;
					if(doc.owner&&doc.owner.m_current_find_context){
						doc.owner.DestroyFindingContext();
					}
				}
				doc.owner=obj;
				var h_editor=h_obj_area-h_top_find;
				if(doc.ed&&UI.TestOption("show_x_scroll_bar")&&!doc.disable_x_scroll&&h_editor>obj.w_scroll_bar){
					var x_max=doc.GetHorizontalSpan()+UI.GetCharacterAdvance(doc.font,32);
					if(x_max>w_document){
						desc_x_scroll_bar={total_size:x_max,page_size:w_document};
						h_editor-=obj.w_scroll_bar;
					}
				}
				if(UI.enable_timing){
					UI.TimingEvent("starting to RenderWithLineNumbers");
				}
				doc.RenderWithLineNumbers(doc.scroll_x,doc.scroll_y,
					obj.x,obj.y+h_top_find,
					w_obj_area-w_scrolling_area,
					h_editor,"doc",1);
				if(UI.enable_timing){
					UI.TimingEvent("RenderWithLineNumbers done");
				}
				if(was_bound_elsewhere){
					doc.scroll_x=(doc.scroll_x||0);
					doc.scroll_y=(doc.scroll_y||0);
					doc.AutoScroll("center_if_hidden")
					doc.scrolling_animation=undefined;
				}
				var ccnt_tot=doc.ed.GetTextSize()
				var ytot=doc.ed.XYFromCcnt(ccnt_tot).y+doc.ed.GetCharacterHeightAt(ccnt_tot)
				if(h_editor>ytot){
					h_editor=Math.min(h_editor,ytot+UI.GetCharacterHeight(doc.font));
					y_bottom_shadow=ytot;
				}
				//doc.precise_ctrl_lr_stop=UI.TestOption("precise_ctrl_lr_stop");
				//doc.same_line_only_left_right=!UI.TestOption("left_right_line_wrap");
				//wrap width widget
				if(obj.doc.m_enable_wrapping&&!obj.m_is_preview){
					var x_wrap_bar=w_line_numbers+obj.doc.displayed_wrap_width-obj.doc.visible_scroll_x+12;
					if(w_obj_area-w_scrolling_area-x_wrap_bar>0){
						//UI.RoundRect({
						//	x:obj.x+x_wrap_bar,
						//	y:doc.y,
						//	w:obj.wrap_bar_size,
						//	h:doc.h,
						//	color:obj.wrap_bar_color})
						w_right_shadow=x_wrap_bar;
						//the mouse interaction
						W.Region('wrapbar_widget',{
							x:obj.x+x_wrap_bar+(obj.wrap_bar_size-obj.wrap_bar_region_size)*0.5,
							y:doc.y,
							w:obj.wrap_bar_region_size,
							h:doc.h,
							owner:obj,
							dimension:'x',
							mouse_cursor:'sizewe',
							value:obj.doc.displayed_wrap_width,
							value_min:64,
							value_max:65536,
							factor:1,
							OnChange:function(value){
								var doc=this.owner.doc
								if(!doc||!doc.m_enable_wrapping){return;}
								doc.displayed_wrap_width=value;
								this.value=value;
								UI.Refresh()
							},
							OnApply:function(value){
								var doc=this.owner.doc
								var renderer=doc.GetRenderer();
								var ed_caret_original=doc.GetCaretXY();
								var scroll_y_original=doc.scroll_y;
								doc.m_current_wrap_width=value;
								renderer.ResetWrapping(value,doc)
								doc.caret_is_wrapped=0
								doc.ed.InvalidateStates([0,doc.ed.GetTextSize()])
								var ed_caret_new=doc.GetCaretXY();
								doc.scroll_y=scroll_y_original-ed_caret_original.y+ed_caret_new.y;
								doc.AutoScroll("show")
								doc.scrolling_animation=undefined
								doc.CallHooks("wrap")
								obj.SaveMetaData()
								UI.Refresh()
							}
						},W.MinimapThingy_prototype)
						//UI.PushCliprect(obj.x+x_wrap_bar,obj.y,w_obj_area-w_scrolling_area-x_wrap_bar,h_obj_area)
						//UI.RoundRect({
						//	x:obj.x+x_wrap_bar-x_shadow_size_max*2+x_shadow_size,
						//	y:obj.y-x_shadow_size_max,
						//	w:2*x_shadow_size_max, 
						//	h:h_obj_area+x_shadow_size_max*2,
						//	round:x_shadow_size_max,
						//	border_width:-x_shadow_size_max,
						//	color:obj.x_scroll_shadow_color})
						//UI.PopCliprect()
					}
				}
				//status overlay
				if(doc&&obj.h>=UI.GetCharacterHeight(doc.font)*2){
					var sel=doc.GetSelection()
					var lcinfo0=doc.GetLC(sel[0])
					var s_status="";
					if(sel[0]<sel[1]){
						var lcinfo1=doc.GetLC(sel[1])
						var n_lines=lcinfo1[0]-lcinfo0[0]
						var n_chars=lcinfo1[2]-lcinfo0[2]
						var n_words=(lcinfo1[3]>>1)-(lcinfo0[3]>>1)
						if(n_chars==1){
							//unicode
							s_status=UI.Format("U+@1",
								ZeroPad(doc.ed.GetUtf8CharNeighborhood(sel[0])[1].toString(16).toUpperCase(),4))
						}else{
							//wc
							if(lcinfo0[3]&1){
								var ch=doc.ed.GetUtf8CharNeighborhood(sel[0])[1]
								if(ch>32){
									n_words++;
								}
							}
							s_status=UI.Format("@1 lines, @2 words, @3 chars, @4 bytes",n_lines.toString(),n_words.toString(),n_chars.toString(),(sel[1]-sel[0]).toString())
						}
						var s_status2=''
						if(!n_lines){
							s_status2=UI.Format("Ln @1,@2-@3",(lcinfo0[0]+1).toString(),(lcinfo0[1]+1).toString(),(lcinfo1[1]+1).toString())
						}else{
							s_status2=UI.Format("Ln @1,@2-@3,@4",(lcinfo0[0]+1).toString(),(lcinfo0[1]+1).toString(),(lcinfo1[0]+1).toString(),(lcinfo1[1]+1).toString())
						}
						s_status=s_status+", "+s_status2;
					}else{
						//lc
						s_status=UI.Format("Ln @1,@2",(lcinfo0[0]+1).toString(),(lcinfo0[1]+1).toString())
					}
					var status_dims=UI.MeasureText(obj.status_bar_font,s_status)
					var ytot=doc.ed.XYFromCcnt(ccnt_tot).y+doc.ed.GetCharacterHeightAt(ccnt_tot)
					var status_x=obj.x+(w_right_shadow==undefined?w_obj_area-w_scrolling_area:w_right_shadow)-status_dims.w-obj.status_bar_padding*2;
					var status_y=obj.y+(y_bottom_shadow==undefined?h_editor:y_bottom_shadow)+h_top_find-status_dims.h-obj.status_bar_padding*2;
					UI.RoundRect({
						color:obj.status_bar_bgcolor,
						x:status_x,y:status_y,w:status_dims.w+obj.status_bar_padding*2,h:status_dims.h+obj.status_bar_padding*2,
						round:obj.status_bar_padding,
						border_width:0})
					W.Text("",{
						x:status_x+obj.status_bar_padding,y:status_y+obj.status_bar_padding,
						font:obj.status_bar_font,color:obj.status_bar_text_color,
						text:s_status})
				}
			}
			if(!doc){
				doc=obj.doc
			}
			if(obj.m_replace_context){
				//replace hint
				var rctx=obj.m_replace_context
				var srep_ccnt0=rctx.m_locators[0].ccnt
				var srep_ccnt1=rctx.m_locators[1].ccnt
				if(srep_ccnt0<srep_ccnt1){
					s_replace=doc.ed.GetText(srep_ccnt0,srep_ccnt1-srep_ccnt0)
				}else{
					s_replace='';
				}
				if(srep_ccnt0<=doc.sel0.ccnt&&doc.sel0.ccnt<=srep_ccnt1&&
				srep_ccnt0<=doc.sel1.ccnt&&doc.sel1.ccnt<=srep_ccnt1){
					doc.m_hide_prev_next_buttons=0;
				}else if(doc.sel0.ccnt!=doc.sel1.ccnt){
					doc.m_hide_prev_next_buttons=0;
				}
				obj.DismissNotification('replace_hint')
				if(rctx.m_needle==s_replace){
					obj.DismissNotification('find_result')
				}else{
					if(rctx.m_ae_prg){
						//use coloring
						var s_middle=UI._('  \u2193 regexp \u2193');
						var s_text=[rctx.m_ae_raw_text,s_middle,s_replace].join("\n");
						var offset_tar=rctx.m_ae_raw_text.length+s_middle.length+2
						var ranges=[];
						for(var i=0;i<rctx.m_ae_match_table.length;i+=3){
							var psrc=rctx.m_ae_match_table[i+0]-1;
							var ptar=rctx.m_ae_match_table[i+1]+offset_tar;
							var lg=rctx.m_ae_match_table[i+2];
							ranges.push([psrc*2+1,i/3],[(psrc+lg)*2,0])
							ranges.push([ptar*2+1,i/3],[(ptar+lg)*2,0])
						}
						ranges.sort(function(a,b){return a[0]-b[0]})
						var p_last=0;
						var a_rich=[];
						var stk=[0];
						var notification_style=UI.default_styles.code_editor_notification
						var p_color_max=11;//notification_style.styles.length;
						for(var i=0;i<ranges.length;i++){
							var p_i=(ranges[i][0]>>1);
							if(p_last<p_i){
								a_rich.push(s_text.substr(p_last,p_i-p_last))
								p_last=p_i;
							}
							if(ranges[i][0]&1){
								stk.push(ranges[i][1]%(p_color_max-1)+1);
							}else{
								stk.pop()
							}
							a_rich.push(UI.ED_RichTextCommandChar(
								UI.RICHTEXT_COMMAND_SET_STYLE+stk[stk.length-1]))
						}
						if(p_last<s_text.length){
							a_rich.push(s_text.substr(p_last))
							p_last=p_i;
						}
						s_text=a_rich.join("");
						obj.CreateNotification({
							id:'find_result',icon:"换",text:s_text,
						},"quiet")
					}else{
						obj.CreateNotification({
							id:'find_result',icon:"换",text:[rctx.m_needle,'  \u2193',s_replace].join("\n")
						},"quiet")
					}
				}
			}
			//generic drawing function
			//the find bar and stuff
			if(obj.show_find_bar&&current_find_context){
				//draw the find items
				doc.ed.m_other_overlay=undefined
				UI.PushSubWindow(obj.x,obj.y+obj.h_find_bar,w_obj_area-w_scrolling_area,h_obj_area-obj.h_find_bar,obj.find_item_scale)
				var hc=UI.GetCharacterHeight(doc.font)
				var w_find_items=(w_obj_area-w_scrolling_area)/obj.find_item_scale;
				var render_secs=0,ln_secs=0;
				//DrawItem
				var renderer=doc.GetRenderer();
				var bk_m_enable_hidden=renderer.m_enable_hidden;
				renderer.m_enable_hidden=((current_find_context.m_flags&UI.SEARCH_FLAG_HIDDEN)?0:1)
				current_find_context.RenderVisibleFindItems(w_line_numbers+obj.padding,w_find_items,h_obj_area-obj.h_find_bar)
				renderer.m_enable_hidden=bk_m_enable_hidden;
				if(!current_find_context.m_forward_matches.length&&!current_find_context.m_backward_matches.length&&
				current_find_context.m_needle.length&&
				!(current_find_context.m_flags&(UI.SEARCH_FLAG_REGEXP|UI.SEARCH_FLAG_FUZZY|UI.SEARCH_FLAG_GLOBAL|UI.SEARCH_FLAG_GOTO_MODE))){
					if(UI.IsSearchFrontierCompleted(current_find_context.m_forward_frontier)&&UI.IsSearchFrontierCompleted(current_find_context.m_backward_frontier)){
						//print("fuzzy search reset")
						obj.ResetFindingContext(current_find_context.m_needle,current_find_context.m_find_flags|UI.SEARCH_FLAG_FUZZY)
						UI.Refresh()
					}
				}
				//print(render_secs*1000,ln_secs*1000)
				UI.PopSubWindow()
			}else{
				////////////////
				//the top hint, do it after since its Render screws the spell checks
				if(top_hint_bbs.length){
					var w_top_hint=(w_right_shadow==undefined?w_obj_area-w_scrolling_area:w_right_shadow);
					var y_top_hint=y_top_hint_scroll;
					UI.RoundRect({color:obj.line_number_bgcolor,x:obj.x,y:obj.y,w:w_line_numbers,h:h_top_hint})
					UI.RoundRect({color:obj.bgcolor,x:obj.x+w_line_numbers,y:obj.y,w:w_top_hint-w_line_numbers,h:h_top_hint})
					var renderer=doc.GetRenderer();
					var bk_m_enable_hidden=renderer.m_enable_hidden;
					renderer.m_enable_hidden=0
					for(var bbi=0;bbi<top_hint_bbs.length;bbi+=2){
						var y0=top_hint_bbs[bbi]
						var y1=top_hint_bbs[bbi+1]
						var hh=Math.min(y1-y0,h_top_hint-y_top_hint)
						if(hh>=0){
							//print('draw',y0,(obj.y+y_top_hint)*UI.pixels_per_unit,doc.ed.SeekXY(0,y0))
							var renderer=doc.GetRenderer();
							renderer.m_temporarily_disable_spell_check=1
							doc.RenderWithLineNumbers(0,y0,obj.x,obj.y+y_top_hint,w_top_hint,hh,0,1)
							renderer.m_temporarily_disable_spell_check=0
							//also draw the line numbers
						}
						y_top_hint+=y1-y0;
					}
					renderer.m_enable_hidden=bk_m_enable_hidden;
				}
				if(top_hint_bbs.length||doc.visible_scroll_y>0){
					var w_top_hint=(w_right_shadow==undefined||!top_hint_bbs.length?w_obj_area-w_scrolling_area:w_right_shadow);
					UI.PushCliprect(obj.x,obj.y+h_top_hint,w_top_hint,h_obj_area-h_top_hint)
					var top_hint_shadow_size=obj.top_hint_shadow_size;
					var hc=UI.GetCharacterHeight(doc.font);
					if(!top_hint_bbs.length){
						top_hint_shadow_size*=Math.min(doc.visible_scroll_y/hc,1);
					}
					//a (shadowed) separation bar
					UI.RoundRect({
						x:obj.x-top_hint_shadow_size, y:obj.y+h_top_hint-top_hint_shadow_size, w:w_top_hint+2*top_hint_shadow_size, h:top_hint_shadow_size*2,
						round:top_hint_shadow_size,
						border_width:-top_hint_shadow_size,
						color:obj.top_hint_shadow_color})
					if(top_hint_bbs.length){
						UI.RoundRect({
							x:obj.x, y:obj.y+h_top_hint, w:w_top_hint, h:obj.top_hint_border_width,
							color:obj.top_hint_border_color})
					}
					UI.PopCliprect()
				}
			}
			if(obj.show_find_bar){
				//print(obj.disclaimer_animation&&obj.disclaimer_animation.alpha)
				//var disclaimer_animation=W.AnimationNode("disclaimer_animation",{
				//	transition_dt:obj.disclaimer_transition_dt,
				//	alpha:(current_find_context&&(current_find_context.m_flags&UI.SEARCH_FLAG_FUZZY?1.0:0.0)),})
				var disclaimer_alpha=(current_find_context&&(current_find_context.m_flags&UI.SEARCH_FLAG_FUZZY?1.0:0.0))
				//the find bar
				UI.PushCliprect(obj.x,obj.y,w_obj_area-w_scrolling_area,h_obj_area)
				UI.RoundRect({
					x:obj.x-obj.find_bar_shadow_size, y:obj.y+obj.h_find_bar-obj.find_bar_shadow_size, w:w_obj_area-w_scrolling_area+2*obj.find_bar_shadow_size, h:obj.find_bar_shadow_size*2,
					round:obj.find_bar_shadow_size,
					border_width:-obj.find_bar_shadow_size,
					color:obj.find_bar_shadow_color})
				UI.PopCliprect()
				UI.RoundRect({x:obj.x,y:obj.y,w:w_obj_area-w_scrolling_area,h:obj.h_find_bar,
					color:obj.find_bar_bgcolor})
				var show_flag_buttons=!(obj.show_find_bar&UI.SEARCH_FLAG_GOTO_MODE)
				//fuzzy match disclaimer... fade, red search bar with "fuzzy match" written on
				var x_rect_bar=obj.x+obj.find_bar_padding;
				var w_rect_bar=w_obj_area-w_scrolling_area-obj.find_bar_padding*2-(obj.find_bar_button_size+obj.find_bar_padding)*(show_flag_buttons?7:1);
				var x_buttons=x_rect_bar+w_rect_bar;
				var rect_bar=UI.RoundRect({
					x:x_rect_bar,y:obj.y+obj.find_bar_padding,
					w:w_rect_bar,
					h:obj.h_find_bar-obj.find_bar_padding*2,
					color:UI.lerp_rgba(obj.find_bar_color,obj.disclaimer_color,(disclaimer_alpha||0)*0.125),
					round:obj.find_bar_round})
				var chr_icon='s'.charCodeAt(0);
				if(obj.show_find_bar&UI.SEARCH_FLAG_GOTO_MODE){
					chr_icon='去'.charCodeAt(0);
				}else if(disclaimer_alpha>0){
					chr_icon='糊'.charCodeAt(0);
				}
				UI.DrawChar(UI.icon_font_20,rect_bar.x+obj.find_bar_padding,obj.y+(obj.h_find_bar-UI.GetCharacterHeight(UI.icon_font_20))*0.5,
					UI.lerp_rgba(obj.find_bar_hint_color,obj.disclaimer_color,disclaimer_alpha||0),chr_icon)
				var x_button_right=x_buttons+obj.find_bar_padding
				if(obj.show_find_bar&UI.SEARCH_FLAG_GLOBAL){
					//draw project name
					//UI.DrawChar(UI.icon_font_20,
					//	x_rect_bar,obj.y+(obj.h_find_bar-20)*0.5,
					//	UI.default_styles.check_button.text_color,0x5939)//'夹'.charCodeAt(0)
					//x_rect_bar+=20;
					var spath_repo=UI.GetEditorProject(doc.m_file_name);
					var s_global_search_hint=(spath_repo?UI.Format("in project '@1'",UI.RemovePath(spath_repo)):"")
					//var dims=UI.MeasureText(obj.find_bar_hint_font,s_global_search_hint);
					//W.Text("",{x:x_rect_bar+w_rect_bar-dims.w-obj.find_bar_padding,y:obj.y+(obj.h_find_bar-dims.h)*0.5,
					//	font:obj.find_bar_hint_font,color:UI.default_styles.check_button.text_color,
					//	text:s_global_search_hint})
					//w_rect_bar-=dims.w+obj.find_bar_padding*2;
					W.Text("",{x:8,
						anchor:rect_bar,anchor_align:'right',anchor_yalign:'up',
						font:obj.find_bar_hint_font,
						color:obj.find_bar_hint_color,
						text:s_global_search_hint})
				}else if(disclaimer_alpha>0){
					//"fuzzy search" text
					W.Text("",{x:8,
						anchor:rect_bar,anchor_align:'right',anchor_yalign:'up',
						font:obj.find_bar_hint_font,
						color:UI.lerp_rgba(obj.disclaimer_color&0x00ffffff,obj.disclaimer_color,disclaimer_alpha),
						text:UI._("fuzzy search")})
				}else if(obj.m_current_find_context&&obj.m_current_find_context.m_goto_line_error){
					W.Text("",{x:8,
						anchor:rect_bar,anchor_align:'right',anchor_yalign:'up',
						font:obj.find_bar_hint_font,
						color:obj.disclaimer_color,
						text:obj.m_current_find_context.m_goto_line_error})
				}
				if(show_flag_buttons){
					var btn_case=W.Button("find_button_case",{style:UI.default_styles.check_button,
						x:x_button_right,y:rect_bar.y+(rect_bar.h-obj.find_bar_button_size)*0.5,w:obj.find_bar_button_size,h:obj.find_bar_button_size,
						font:UI.icon_font,text:"写",tooltip:UI._("Case sensitive - ALT+C"),
						value:(UI.m_ui_metadata["<find_state>"].m_find_flags&UI.SEARCH_FLAG_CASE_SENSITIVE?1:0),
						OnChange:function(value){
							UI.m_ui_metadata["<find_state>"].m_find_flags=(UI.m_ui_metadata["<find_state>"].m_find_flags&~UI.SEARCH_FLAG_CASE_SENSITIVE)|(value?UI.SEARCH_FLAG_CASE_SENSITIVE:0)
							obj.DestroyReplacingContext();
							var ctx=obj.m_current_find_context;
							if(ctx){ctx.RestoreSel();}
							obj.ResetFindingContext(obj.find_bar_edit.ed.GetText(),UI.m_ui_metadata["<find_state>"].m_find_flags)
							UI.Refresh()
						}})
					W.Hotkey("",{key:"ALT+C",action:function(){btn_case.OnClick()}})
					x_button_right+=obj.find_bar_padding+obj.find_bar_button_size;
					var btn_word=W.Button("find_button_word",{style:UI.default_styles.check_button,
						x:x_button_right,y:rect_bar.y+(rect_bar.h-obj.find_bar_button_size)*0.5,w:obj.find_bar_button_size,h:obj.find_bar_button_size,
						font:UI.icon_font,text:"字",tooltip:UI._("Whole word - ALT+H"),
						value:(UI.m_ui_metadata["<find_state>"].m_find_flags&UI.SEARCH_FLAG_WHOLE_WORD?1:0),
						OnChange:function(value){
							UI.m_ui_metadata["<find_state>"].m_find_flags=(UI.m_ui_metadata["<find_state>"].m_find_flags&~UI.SEARCH_FLAG_WHOLE_WORD)|(value?UI.SEARCH_FLAG_WHOLE_WORD:0)
							obj.DestroyReplacingContext();
							var ctx=obj.m_current_find_context;
							if(ctx){ctx.RestoreSel();}
							obj.ResetFindingContext(obj.find_bar_edit.ed.GetText(),UI.m_ui_metadata["<find_state>"].m_find_flags)
							UI.Refresh()
						}})
					W.Hotkey("",{key:"ALT+H",action:function(){btn_word.OnClick()}})
					x_button_right+=obj.find_bar_padding+obj.find_bar_button_size;
					var btn_regexp=W.Button("find_button_regexp",{style:UI.default_styles.check_button,
						x:x_button_right,y:rect_bar.y+(rect_bar.h-obj.find_bar_button_size)*0.5,w:obj.find_bar_button_size,h:obj.find_bar_button_size,
						font:UI.icon_font,text:"正",tooltip:UI._("Regular expression - ALT+E"),
						value:(UI.m_ui_metadata["<find_state>"].m_find_flags&UI.SEARCH_FLAG_REGEXP?1:0),
						OnChange:function(value){
							UI.m_ui_metadata["<find_state>"].m_find_flags=(UI.m_ui_metadata["<find_state>"].m_find_flags&~UI.SEARCH_FLAG_REGEXP)|(value?UI.SEARCH_FLAG_REGEXP:0)
							obj.DestroyReplacingContext();
							var ctx=obj.m_current_find_context;
							if(ctx){ctx.RestoreSel();}
							obj.ResetFindingContext(obj.find_bar_edit.ed.GetText(),UI.m_ui_metadata["<find_state>"].m_find_flags)
							UI.Refresh()
						}})
					W.Hotkey("",{key:"ALT+E",action:function(){btn_regexp.OnClick();}})
					x_button_right+=obj.find_bar_padding+obj.find_bar_button_size;
					var btn_fold=W.Button("find_button_fold",{style:UI.default_styles.check_button,
						x:x_button_right,y:rect_bar.y+(rect_bar.h-obj.find_bar_button_size)*0.5,w:obj.find_bar_button_size,h:obj.find_bar_button_size,
						font:UI.icon_font,text:"叠",tooltip:UI._("Convert to wildcard - ALT+LEFT"),
						OnClick:function(value){
							var doc_fbar=obj.find_bar_edit;
							var sel_fbar=doc_fbar.GetSelection();
							if(!(sel_fbar[1]>sel_fbar[0])){return;}
							var ssource_text=doc_fbar.ed.GetText(sel_fbar[0],sel_fbar[1]-sel_fbar[0]);
							if((UI.m_ui_metadata["<find_state>"].m_find_flags&UI.SEARCH_FLAG_REGEXP)){
								//crude unescape
								var in_slash=0;
								var unescaped_ret=[];
								for(var i=0;i<ssource_text.length;i++){
									var ch=ssource_text[i];
									if(in_slash){
										unescaped_ret.push(ch);
										in_slash=0
									}else if(ch=='\\'){
										in_slash=1;
									}else{
										unescaped_ret.push(ch);
									}
								}
								ssource_text=unescaped_ret.join("");
							}
							var starget_text="(.+)";
							for(var i=0;i<g_regexp_folding_templates.length;i++){
								if(ssource_text.search(g_regexp_folding_templates[i].regexp)>=0){
									starget_text=g_regexp_folding_templates[i].starget;
									break;
								}
							}
							if(!(UI.m_ui_metadata["<find_state>"].m_find_flags&UI.SEARCH_FLAG_REGEXP)){
								var sztext=doc_fbar.ed.GetTextSize();
								var s0=RegexpEscape(doc_fbar.ed.GetText(0,sel_fbar[0]));
								doc_fbar.ed.Edit([0,sztext,
									[s0,starget_text,RegexpEscape(doc_fbar.ed.GetText(sel_fbar[1],sztext-sel_fbar[1]))].join('')]);
								sel_fbar[0]=Duktape.__byte_length(s0);
							}else{
								doc_fbar.ed.Edit([sel_fbar[0],sel_fbar[1]-sel_fbar[0],starget_text]);
							}
							doc_fbar.SetSelection(sel_fbar[0],sel_fbar[0]+Duktape.__byte_length(starget_text));
							UI.m_ui_metadata["<find_state>"].m_find_flags|=UI.SEARCH_FLAG_REGEXP;
							obj.DestroyReplacingContext();
							var ctx=obj.m_current_find_context;
							if(ctx){ctx.RestoreSel();}
							obj.ResetFindingContext(obj.find_bar_edit.ed.GetText(),UI.m_ui_metadata["<find_state>"].m_find_flags)
							UI.Refresh()
						}})
					W.Hotkey("",{key:"ALT+LEFT",action:function(){btn_fold.OnClick()}})
					x_button_right+=obj.find_bar_padding+obj.find_bar_button_size;
					var btn_code=W.Button("find_button_code",{style:UI.default_styles.check_button,
						x:x_button_right,y:rect_bar.y+(rect_bar.h-obj.find_bar_button_size)*0.5,w:obj.find_bar_button_size,h:obj.find_bar_button_size,
						font:UI.icon_font,text:"プ",tooltip:UI._("Code only - ALT+D"),
						value:(UI.m_ui_metadata["<find_state>"].m_find_flags&UI.SEARCH_FLAG_CODE_ONLY?1:0),
						OnChange:function(value){
							UI.m_ui_metadata["<find_state>"].m_find_flags=(UI.m_ui_metadata["<find_state>"].m_find_flags&~UI.SEARCH_FLAG_CODE_ONLY)|(value?UI.SEARCH_FLAG_CODE_ONLY:0)
							obj.DestroyReplacingContext();
							var ctx=obj.m_current_find_context;
							if(ctx){ctx.RestoreSel();}
							obj.ResetFindingContext(obj.find_bar_edit.ed.GetText(),UI.m_ui_metadata["<find_state>"].m_find_flags)
							UI.Refresh()
						}})
					W.Hotkey("",{key:"ALT+D",action:function(){btn_code.OnClick()}})
					x_button_right+=obj.find_bar_padding+obj.find_bar_button_size;
					var btn_hidden=W.Button("find_button_hidden",{style:UI.default_styles.check_button,
						x:x_button_right,y:rect_bar.y+(rect_bar.h-obj.find_bar_button_size)*0.5,w:obj.find_bar_button_size,h:obj.find_bar_button_size,
						font:UI.icon_font,text:"藏",tooltip:UI._("Search hidden text - ALT+T"),
						value:(UI.m_ui_metadata["<find_state>"].m_find_flags&UI.SEARCH_FLAG_HIDDEN?1:0),
						OnChange:function(value){
							UI.m_ui_metadata["<find_state>"].m_find_flags=(UI.m_ui_metadata["<find_state>"].m_find_flags&~UI.SEARCH_FLAG_HIDDEN)|(value?UI.SEARCH_FLAG_HIDDEN:0)
							obj.DestroyReplacingContext();
							var ctx=obj.m_current_find_context;
							if(ctx){ctx.RestoreSel();}
							obj.ResetFindingContext(obj.find_bar_edit.ed.GetText(),UI.m_ui_metadata["<find_state>"].m_find_flags)
							UI.Refresh()
						}})
					W.Hotkey("",{key:"ALT+T",action:function(){btn_hidden.OnClick()}})
					x_button_right+=obj.find_bar_padding+obj.find_bar_button_size;
				}
				W.Button("find_button_close",{style:UI.default_styles.check_button,
					x:x_button_right+2,y:rect_bar.y+(rect_bar.h-obj.find_bar_button_size)*0.5+2,w:obj.find_bar_button_size-4,h:obj.find_bar_button_size-4,
					font:UI.icon_font_20,text:"✕",tooltip:UI._("Close - ESC"),
					OnClick:function(){
						var ctx=obj.m_current_find_context
						if(ctx){
							ctx.CancelFind();
						}
					}})
				var x_find_edit=rect_bar.x+obj.find_bar_padding*2+UI.GetCharacterAdvance(UI.icon_font_20,chr_icon);
				var w_find_edit=rect_bar.x+rect_bar.w-obj.find_bar_padding-x_find_edit;
				var previous_find_bar_edit=obj.find_bar_edit
				W.Edit("find_bar_edit",{
					language:doc.language,
					plugin_language_desc:doc.plugin_language_desc,
					style:obj.find_bar_editor_style,
					x:x_find_edit,w:w_find_edit,y:rect_bar.y,h:rect_bar.h,
					find_bar_owner:obj,
					plugins:[ffindbar_plugin],
					precise_ctrl_lr_stop:UI.TestOption("precise_ctrl_lr_stop"),
					same_line_only_left_right:!UI.TestOption("left_right_line_wrap"),
					tab_width:UI.GetOption("tab_width",4),
					OnBlur:function(nd_new){
						if(nd_new==doc){
							var obj=this.find_bar_owner
							var ctx=obj.m_current_find_context
							if(ctx&&!ctx.m_confirmed){
								ctx.CancelFind();
							}
						}
					},
				},W.CodeEditor_prototype);
				if(!previous_find_bar_edit){
					//the darn buttons do make sense in ctrl+g mode!
					var find_flag_mode=(obj.show_find_bar&~UI.SEARCH_FLAG_SHOW)
					if(UI.m_ui_metadata["<find_state>"].m_current_needle||(obj.show_find_bar&UI.SEARCH_FLAG_GOTO_MODE)){
						if(UI.m_ui_metadata["<find_state>"].m_current_needle&&!(obj.show_find_bar&UI.SEARCH_FLAG_GOTO_MODE)){
							obj.find_bar_edit.HookedEdit([0,0,UI.m_ui_metadata["<find_state>"].m_current_needle],1)
							obj.find_bar_edit.AutoScroll('center')
						}
						obj.find_bar_edit.sel0.ccnt=0
						obj.find_bar_edit.sel1.ccnt=obj.find_bar_edit.ed.GetTextSize()
						obj.ResetFindingContext(obj.find_bar_edit.ed.GetText(),UI.m_ui_metadata["<find_state>"].m_find_flags|find_flag_mode)
					}
					UI.SetFocus(obj.find_bar_edit);
					UI.InvalidateCurrentFrame();
					UI.Refresh()
				}else if(UI.nd_focus==doc){
					UI.SetFocus(obj.find_bar_edit);
					UI.InvalidateCurrentFrame();
					UI.Refresh()
				}
				if(!obj.find_bar_edit.ed.GetTextSize()&&!obj.find_bar_edit.ed.m_IME_overlay){
					W.Text("",{x:x_find_edit+2,w:w_find_edit,y:rect_bar.y,h:rect_bar.h,
						font:obj.find_bar_hint_font,color:obj.find_bar_hint_color,
						text:(obj.show_find_bar&UI.SEARCH_FLAG_GOTO_MODE)?"Go to function / class / line number":"Search"})
				}
			}else{
				//obj.find_bar_edit=undefined;
				//horizontal scrollbar
				if(desc_x_scroll_bar){
					var y_horizontal_scrollbar=h_obj_area-obj.w_scroll_bar;
					if(y_bottom_shadow!=undefined){
						y_horizontal_scrollbar=y_bottom_shadow;
						y_bottom_shadow+=obj.w_scroll_bar;
					}
					var sbar_value_x=Math.max(Math.min(doc.visible_scroll_x/(desc_x_scroll_bar.total_size-desc_x_scroll_bar.page_size),1),0);
					var sbar=UI.RoundRect({
						x:obj.x, y:obj.y+y_horizontal_scrollbar, 
						w:w_obj_area-w_scrolling_area+(obj.doc.notebook_owner?0:1), h:obj.w_scroll_bar,
						color:obj.line_number_bgcolor
					})
					var sbar_x_padding=0;
					if(w_obj_area-w_scrolling_area>8){
						sbar_x_padding=4;
					}
					W.ScrollBar("sbar_x",{
						x:obj.x+sbar_x_padding, y:obj.y+y_horizontal_scrollbar,
						w:w_obj_area-w_scrolling_area-2*sbar_x_padding, h:obj.w_scroll_bar, dimension:'x',
						page_size:desc_x_scroll_bar.page_size, 
						total_size:desc_x_scroll_bar.total_size, value:sbar_value_x,
						OnChange:function(value){
							doc.scroll_x=value*(this.total_size-this.page_size)
							doc.scrolling_animation=undefined
							UI.Refresh()
						},
					})
					UI.RoundRect({
						x:sbar.x, y:sbar.y, w:sbar.w, h:1,
						color:obj.separator_color})
					//UI.RoundRect({
					//	x:sbar.x, y:sbar.y+sbar.h-1, w:sbar.w, h:1,
					//	color:obj.separator_color})
				}
			}
			//UI.RoundRect({
			//	x:obj.x+w_line_numbers-1, y:obj.y, w:1, h:h_obj_area,
			//	color:obj.separator_color})
			var got_gotodef_notification=0;
			if(UI.HasFocus(doc)){
				var menu_edit=UI.BigMenu("&Edit")
				menu_edit.AddNormalItem({text:"&Undo",icon:"撤",enable_hotkey:0,key:"CTRL+Z",action:function(){
					doc.Undo()
				}});
				menu_edit.AddNormalItem({text:"&Redo",icon:"做",enable_hotkey:0,key:"SHIFT+CTRL+Z",action:function(){
					doc.Redo()
				}});
				if(doc.ed.GetUndoQueueLength()>0){
					UI.ToolButton("undo",{tooltip:"Undo - CTRL+Z",action:function(){doc.Undo();}})
				}
				if(doc.ed.GetRedoQueueLength()>0){
					UI.ToolButton("redo",{tooltip:"Redo - SHIFT+CTRL+Z",action:function(){doc.Redo();}})
				}
				///////////////////////
				menu_edit.AddSeparator()
				menu_edit.AddNormalItem({text:"Select &all",enable_hotkey:0,key:"CTRL+A",action:function(){
					doc.sel0.ccnt=0
					doc.sel1.ccnt=doc.ed.GetTextSize()
					doc.CallOnSelectionChange()
					UI.Refresh()
				}})
				if(doc.sel0.ccnt!=doc.sel1.ccnt){
					menu_edit.AddNormalItem({text:"&Copy",icon:"拷",context_menu_group:"edit",enable_hotkey:0,key:"CTRL+C",action:function(){
						doc.Copy()
					}})
					if(!obj.read_only){
						menu_edit.AddNormalItem({text:"Cu&t",icon:"剪",context_menu_group:"edit",enable_hotkey:0,key:"CTRL+X",action:function(){
							doc.Cut()
						}})
					}
				}
				if(!obj.read_only&&UI.SDL_HasClipboardText()){
					menu_edit.AddNormalItem({text:"&Paste",context_menu_group:"edit",enable_hotkey:0,key:"CTRL+V",action:function(){
						doc.Paste()
					}})
				}
				menu_edit.p_paste=menu_edit.$.length
				///////////////////////
				var acctx=doc.m_ac_context
				if(acctx){
					menu_edit.AddSeparator()
					if(acctx.m_n_cands==1||acctx.m_accands.m_common_prefix){
						menu_edit.AddNormalItem({text:"Auto-complete",enable_hotkey:1,key:"TAB",action:function(){
							doc.ConfirmAC(acctx.m_n_cands==1?0:undefined)
						}})
					}else if(!doc.m_ac_activated){
						menu_edit.AddNormalItem({text:"Auto-complete",enable_hotkey:1,key:"TAB",action:function(){
							doc.ActivateAC()
						}})
					}else{
						//the keys: left/right -= 1234567890, enter / space / tab
						var fprevpage=function(){
							acctx.m_scroll_i=Math.max(acctx.m_scroll_i-(obj.accands_n_shown),0)
							acctx.m_selection=acctx.m_scroll_i
							UI.Refresh()
						}
						var fnextpage=function(){
							acctx.m_scroll_i=Math.min(acctx.m_scroll_i+(obj.accands_n_shown),acctx.m_n_cands-1)
							acctx.m_selection=acctx.m_scroll_i
							UI.Refresh()
						}
						var fprevcand=function(){
							if(acctx.m_selection>0){
								acctx.m_selection--
								if(acctx.m_selection<acctx.m_scroll_i){
									acctx.m_scroll_i=Math.max(acctx.m_scroll_i-(obj.accands_n_shown),0)
								}
								UI.Refresh();
							}
						}
						var fnextcand=function(){
							if(acctx.m_selection<acctx.m_n_cands-1){
								acctx.m_selection++
								if(acctx.m_scroll_i+obj.accands_n_shown<=acctx.m_selection){
									acctx.m_scroll_i=Math.min(acctx.m_scroll_i+(obj.accands_n_shown),acctx.m_n_cands-1)
								}
								UI.Refresh();
							}
						}
						var fconfirm=function(){
							doc.ConfirmAC(acctx.m_selection)
						}
						//need this for hotkeys - RETURN
						//menu_edit.AddButtonRow({text:"Auto-complete"},[
						//	{text:"<",tooltip:'- or ,',action:fprevpage},
						//	{key:"RETURN RETURN2",text:"confirm",tooltip:'ENTER or SPACE',action:fconfirm},
						//	{text:">",tooltip:'= or .',action:fnextpage}])
						//W.Hotkey("",{text:",",action:fprevpage})
						//W.Hotkey("",{text:".",action:fnextpage})
						doc.AddTransientHotkey("-",fprevpage)
						doc.AddTransientHotkey("=",fnextpage)
						doc.AddTransientHotkey("LEFT",fprevcand)
						doc.AddTransientHotkey("RIGHT",fnextcand)
						doc.AddTransientHotkey(" ",fconfirm)
						doc.AddTransientHotkey("TAB",fconfirm)
						doc.AddTransientHotkey("RETURN RETURN2",fconfirm)
					}
				}
				///////////////////////
				var menu_search=UI.BigMenu("&Search")
				menu_search.AddNormalItem({text:"&Find or replace...",icon:"s",enable_hotkey:1,key:"CTRL+F",action:finvoke_find.bind(obj,UI.SHOW_FIND)})
				W.Hotkey("",{key:"CTRL+R",action:finvoke_find.bind(obj,UI.SHOW_FIND)})
				menu_search.AddNormalItem({text:"Find in project...",enable_hotkey:1,key:"SHIFT+CTRL+F",action:finvoke_find.bind(obj,UI.SHOW_GLOBAL_FIND)})
				menu_search.AddButtonRow({text:"Find previous / next"},[
					{key:"SHIFT+F3",text:"find_up",icon:"上",tooltip:'Prev - SHIFT+F3',action:function(){
						obj.FindNext(-1)
					}},{key:"F3",text:"find_down",icon:"下",tooltip:'Next - F3',action:function(){
						obj.FindNext(1)
					}}])
				menu_search.AddButtonRow({text:"Find the current word"},[
					{key:"SHIFT+CTRL+F3",text:"word_up",icon:"上",tooltip:'Prev - SHIFT+CTRL+F3',action:function(){
						if(obj.BeforeQuickFind(-1)){
							obj.FindNext(-1);
						}
					}},{key:"CTRL+F3",text:"word_down",icon:"下",tooltip:'Next - CTRL+F3',action:function(){
						if(obj.BeforeQuickFind(1)){
							obj.FindNext(1);
						}
					}}])
				if(obj.m_replace_context){
					var ed_caret=doc.GetIMECaretXY();
					var y_caret=(ed_caret.y-doc.visible_scroll_y);
					var hc=UI.GetCharacterHeight(doc.font)
					UI.DrawPrevNextAllButtons(obj,obj.x+w_line_numbers,obj.y+y_caret+hc*0.5, menu_search,
						"Replace",["Replace previous",doc.sel0.ccnt==doc.sel1.ccnt?"Replace all":"Replace selection","Replace next"],
						function(){obj.DoReplaceFromUI(-1);},
						function(){obj.DoReplaceFromUI( 0);},
						function(){obj.DoReplaceFromUI( 1);})
				}
				menu_search.AddSeparator();
				menu_search.AddNormalItem({text:"&Go to...",icon:'去',enable_hotkey:1,key:"CTRL+G",action:finvoke_goto.bind(obj,UI.SHOW_GOTO)})
				menu_search.AddNormalItem({text:"Go to ... in project",enable_hotkey:1,key:"SHIFT+CTRL+G",action:finvoke_goto.bind(obj,UI.SHOW_GLOBAL_GOTO)})
				UI.ToolButton("goto",{tooltip:"Go to - CTRL+G",action:finvoke_goto.bind(obj,UI.SHOW_GOTO)})
				var neib=doc.ed.GetUtf8CharNeighborhood(doc.sel1.ccnt);
				if(UI.g_goto_definition_context&&obj.m_prev_next_button_drawn!=UI.m_frame_tick){
					//render the current gotodef context, and put up #/# text as notification
					obj.m_prev_next_button_drawn=UI.m_frame_tick;
					var ed_caret=doc.GetIMECaretXY();
					var y_caret=(ed_caret.y-doc.visible_scroll_y);
					var hc=UI.GetCharacterHeight(doc.font)
					var sz_button=obj.autoedit_button_size;
					var padding=obj.autoedit_button_padding;
					var x_button_box=obj.x+w_line_numbers+(ed_caret.x-doc.visible_scroll_x)-sz_button-padding*2;
					var y_button_box=obj.y+y_caret+hc*0.5-sz_button*1-padding;
					var w_button_box=sz_button+padding*2;
					var h_button_box=sz_button*2+padding*2;
					UI.RoundRect({
						x:x_button_box-obj.accands_shadow_size, y:y_button_box, 
						w:w_button_box+obj.accands_shadow_size*2, h:h_button_box+obj.accands_shadow_size,
						round:obj.accands_shadow_size,
						border_width:-obj.accands_shadow_size,
						color:obj.accands_shadow_color})
					UI.RoundRect({
						x:x_button_box, y:y_button_box,
						w:w_button_box, h:h_button_box,
						border_width:obj.accands_border_width,
						border_color:obj.accands_border_color,
						round:obj.accands_round,
						color:obj.accands_bgcolor})
					var fgoto_action=UI.HackCallback(function(delta){
						var gotoctx=UI.g_goto_definition_context;
						if(!gotoctx){return;}
						gotoctx.p_target+=delta*2;
						if(gotoctx.p_target>=gotoctx.gkds.length){
							gotoctx.p_target=0;
						}
						if(gotoctx.p_target<0){
							gotoctx.p_target=gotoctx.gkds.length-2
						}
						var gkds=gotoctx.gkds;
						var ccnt_go=gkds[gotoctx.p_target+1]
						UI.RecordCursorHistroy(doc,"go_to_definition")
						UI.OpenEditorWindow(gkds[gotoctx.p_target+0],function(){
							var doc=this
							var ccnt=ccnt_go
							if(doc.m_diff_from_save){
								ccnt=doc.m_diff_from_save.BaseToCurrent(ccnt)
							}
							doc.SetSelection(ccnt,ccnt)
							UI.g_goto_definition_context=gotoctx;
							UI.g_cursor_history_test_same_reason=1
							UI.Refresh()
						})
						UI.Refresh()
					})
					var gotoctx=UI.g_goto_definition_context;
					got_gotodef_notification=1;
					obj.CreateNotification({id:'definition_id',text:
						UI.Format(UI._("Definition @1 of @2"),(gotoctx.p_target/2+1).toString(),(gotoctx.gkds.length/2).toString())},1)
					W.Button("button_def_up",{style:UI.default_styles.check_button,
						x:x_button_box+padding,y:y_button_box+sz_button*0+padding,
						w:sz_button,h:sz_button,
						font:UI.icon_font_20,text:"上",tooltip:UI._('Previous definition')+' - '+UI.LocalizeKeyName(UI.TranslateHotkey('SHIFT+F12')),
						tooltip_placement:'right',
						OnClick:fgoto_action.bind(obj,-1)})
					W.Button("button_def_down",{style:UI.default_styles.check_button,
						x:x_button_box+padding,y:y_button_box+sz_button*1+padding,
						w:sz_button,h:sz_button,
						font:UI.icon_font_20,text:"下",tooltip:UI._('Next definition')+' - '+UI.LocalizeKeyName(UI.TranslateHotkey('F12')),
						tooltip_placement:'right',
						OnClick:fgoto_action.bind(obj,1)})
					W.Hotkey("",{key:"SHIFT+F12",action:fgoto_action.bind(obj,-1)})
					W.Hotkey("",{key:"F12",action:fgoto_action.bind(obj,1)})
				}else if(doc.ed.m_file_index&&doc.ed.m_file_index.hasDecls()&&(UI.ED_isWordChar(neib[0])||UI.ED_isWordChar(neib[1]))){
					menu_search.AddNormalItem({text:"Go to &definition",context_menu_group:"definition",enable_hotkey:1,key:"F12",action:function(){
						obj.GotoDefinition(0);
					}.bind(obj)})
					menu_search.AddNormalItem({text:"&Peek definition",context_menu_group:"definition",enable_hotkey:1,key:"ALT+F12",action:function(){
						obj.GotoDefinition(1);
					}.bind(obj)})
					menu_search.AddNormalItem({text:"Find all references",context_menu_group:"definition",action:function(){
						var obj=this
						var doc=obj.doc
						var sel=doc.GetSelection();
						var ed=doc.ed
						var ccnt_sel1=doc.sel1.ccnt
						sel[0]=ed.MoveToBoundary(sel[0],-1,"word_boundary_left")
						sel[1]=ed.MoveToBoundary(sel[1],1,"word_boundary_right")
						if(sel[0]<sel[1]){
							var id=ed.GetText(sel[0],sel[1]-sel[0])
							UI.m_ui_metadata["<find_state>"].m_find_flags=(UI.SEARCH_FLAG_CASE_SENSITIVE|UI.SEARCH_FLAG_WHOLE_WORD|UI.SEARCH_FLAG_HIDDEN);
							finvoke_find.call(obj,UI.SHOW_GLOBAL_FIND,id)
						}
					}.bind(obj)})
				}
				doc.CallHooks('menu')
				menu_edit=undefined;
				menu_search=undefined;
			}
			if(!got_gotodef_notification){
				obj.DismissNotification("definition_id")
			}
			if(doc.m_menu_context){
				UI.TopMostWidget(function(){
					var is_first=doc.m_menu_context.is_first;
					var obj_submenu=W.FancyMenu("context_menu",{
						x:doc.m_menu_context.x, y:doc.m_menu_context.y,
						desc:doc.m_menu_context.menu,
						HideMenu:function(){doc.m_menu_context=undefined;},
					})
					if(is_first){
						UI.SetFocus(obj_submenu);
						var y_bounded=Math.max(Math.min(obj_submenu.y,obj.y+obj.h-obj_submenu.h),obj.y);
						if(y_bounded!=obj_submenu.y){
							doc.m_menu_context.y=y_bounded;
							UI.InvalidateCurrentFrame();
							UI.Refresh();
						}
						doc.m_menu_context.is_first=0;
					}
				})
			}else{
				obj.context_menu=undefined;
			}
		}
		if(!is_find_mode_rendering&&!(doc&&doc.m_is_help_page_preview)){
			if(w_right_shadow!=undefined){
				var h_right_shadow=doc.h;
				if(y_bottom_shadow!=undefined){
					h_right_shadow=y_bottom_shadow;
				}
				if(!right_overlay_drawn){
					UI.RoundRect({color:obj.find_mode_bgcolor,x:obj.x+w_right_shadow,y:doc.y,w:w_obj_area-w_scrolling_area-w_right_shadow,h:doc.h})
				}
				UI.PushCliprect(obj.x+w_right_shadow,doc.y,w_obj_area-w_scrolling_area-w_right_shadow,h_right_shadow)
					UI.RoundRect({
						x:obj.x+w_right_shadow-obj.find_item_shadow_size,y:doc.y-obj.find_item_shadow_size,
						w:obj.find_item_shadow_size*2,h:h_right_shadow+obj.find_item_shadow_size*2,
						color:obj.find_item_shadow_color,
						round:obj.find_item_shadow_size,
						border_width:-obj.find_item_shadow_size})
				UI.PopCliprect()
			}
			if(y_bottom_shadow!=undefined){
				if(w_right_shadow==undefined){
					w_right_shadow=w_obj_area;
				}
				if(obj.doc.notebook_owner){
					//nothing for now
					UI.RoundRect({color:obj.line_number_bgcolor,x:obj.x,y:obj.y+y_bottom_shadow,w:w_right_shadow,h:h_obj_area-y_bottom_shadow})
				}else{
					UI.RoundRect({color:obj.find_mode_bgcolor,x:obj.x,y:obj.y+y_bottom_shadow,w:w_right_shadow,h:h_obj_area-y_bottom_shadow})
					UI.PushCliprect(obj.x,obj.y+y_bottom_shadow,w_right_shadow,h_obj_area-y_bottom_shadow)
						UI.RoundRect({x:obj.x-obj.find_item_shadow_size,y:obj.y+y_bottom_shadow-obj.find_item_shadow_size,
							w:w_right_shadow+obj.find_item_shadow_size*2,h:obj.find_item_shadow_size*2,
							color:obj.find_item_shadow_color,
							round:obj.find_item_shadow_size,
							border_width:-obj.find_item_shadow_size})
					UI.PopCliprect()
				}
			}
		}
		if(UI.enable_timing){
			UI.TimingEvent("starting to draw minimap");
		}
		//minimap / scroll bar
		if(doc&&w_scrolling_area>0&&!UI.m_frame_is_invalid&&!doc.m_is_help_page_preview){
			var y_scrolling_area=obj.y
			var effective_scroll_y=doc.visible_scroll_y
			var sbar_value=Math.max(Math.min(effective_scroll_y/(ytot-h_scrolling_area),1),0)
			if(show_minimap){
				var x_minimap=obj.x+w_obj_area-w_scrolling_area+obj.padding*0.5
				var minimap_scale=obj.minimap_font_height/UI.GetFontHeight(editor_style.font)
				var h_minimap=h_scrolling_area/minimap_scale
				var scroll_y_minimap=sbar_value*Math.max(ytot-h_minimap,0)
				UI.PushSubWindow(x_minimap,y_scrolling_area,w_minimap,h_scrolling_area,minimap_scale)
					var renderer=doc.GetRenderer();
					renderer.m_temporarily_disable_spell_check=1
					doc.ed.Render({x:0,y:scroll_y_minimap,w:w_minimap/minimap_scale,h:h_minimap,
						scr_x:0,scr_y:0, scale:UI.pixels_per_unit, obj:doc});
					renderer.m_temporarily_disable_spell_check=0
				UI.PopSubWindow()
				var minimap_page_y0=(effective_scroll_y-scroll_y_minimap)*minimap_scale
				var minimap_page_y1=(effective_scroll_y+h_scrolling_area-scroll_y_minimap)*minimap_scale
				UI.RoundRect({
					x:x_minimap-obj.padding*0.5, y:y_scrolling_area+minimap_page_y0, w:w_minimap+obj.padding, h:minimap_page_y1-minimap_page_y0,
					color:obj.minimap_page_shadow})
				UI.RoundRect({
					x:x_minimap-obj.padding*0.5, y:y_scrolling_area+minimap_page_y0, w:w_minimap+obj.padding, h:obj.minimap_page_border_width,
					color:obj.minimap_page_border_color})
				UI.RoundRect({
					x:x_minimap-obj.padding*0.5, y:y_scrolling_area+minimap_page_y1-obj.minimap_page_border_width, w:w_minimap+obj.padding, h:obj.minimap_page_border_width,
					color:obj.minimap_page_border_color})
				if((minimap_page_y1-minimap_page_y0)<h_minimap){
					W.Region('minimap_page',{
						x:x_minimap-obj.padding*0.5, y:y_scrolling_area+minimap_page_y0, w:w_minimap+obj.padding, h:minimap_page_y1-minimap_page_y0,
						value:sbar_value,
						factor:Math.min(h_scrolling_area,ytot*minimap_scale)-(minimap_page_y1-minimap_page_y0),
						OnChange:function(value){
							doc.scroll_y=value*(ytot-h_scrolling_area)
							doc.scrolling_animation=undefined
							if(is_find_mode_rendering){
								var ctx=obj.m_current_find_context;
								if(ctx){
									var ccnt=doc.ed.SeekXY(0,doc.scroll_y);
									ctx.m_find_scroll_visual_y=ctx.GetFindItem(ctx.SeekMergedItemByUnmergedID(ctx.BisectMatches(doc,ccnt))).visual_y;
									ctx.ValidateFindItemScroll();
								}
							}
							UI.Refresh()
						},
					},W.MinimapThingy_prototype)
				}
			}
			//scrollbar background
			var sbar=UI.RoundRect({x:obj.x+w_obj_area-obj.w_scroll_bar, y:y_scrolling_area, w:obj.w_scroll_bar, h:h_scrolling_area,
				color:obj.line_number_bgcolor
			})
			//at-scrollbar find minimap
			var ctx=obj.m_current_find_context;
			if(!obj.show_find_bar&&show_at_scrollbar_find_minimap&&ctx&&ctx.m_locators){
				//save highlight-computed frontier and merged y ranges in ctx
				if(ctx.m_asbfmm_last_length!=ctx.m_locators.length||ctx.m_asbfmm_h!=sbar.h){
					ctx.m_asbfmm_last_length=ctx.m_locators.length;
					ctx.m_asbfmm_h=sbar.h;
					var findhl_xys=UI.ED_GetFindLocatorXYEnMasse(doc.ed,ctx.m_locators);
					//print(findhl_xys[1],findhl_xys.length)
					var y_ranges=[];
					for(var i=0;i<findhl_xys.length;i+=2){
						var y=Math.max(Math.min(findhl_xys[i+1]/ytot,1),0)*sbar.h-obj.bookmark_scroll_bar_marker_size*0.5;
						var y2=y+obj.bookmark_scroll_bar_marker_size;
						if(!y_ranges.length||y>y_ranges[y_ranges.length-1]){
							y_ranges.push(y,y2)
						}else{
							y_ranges[y_ranges.length-1]=y2;
						}
					}
					ctx.m_asbfmm_y_ranges=y_ranges;
				}
				var y_ranges=ctx.m_asbfmm_y_ranges;
				for(var i=0;i<y_ranges.length;i+=2){
					UI.RoundRect({
						x:sbar.x, w:sbar.w,
						y:sbar.y+y_ranges[i],h:y_ranges[i+1]-y_ranges[i],
						color:doc.rectex_styles[0].color})
				}
			}
			//diff minimap
			if(doc.m_diff_minimap){
				if(obj.m_diff_minimap_h_obj_area!=h_obj_area){
					doc.m_diff_minimap=UI.ED_CreateDiffTrackerBitmap(doc.ed,doc.m_diff_from_save,h_obj_area*UI.pixels_per_unit);
					doc.m_diff_minimap_h_obj_area=h_obj_area
				}
				UI.GLWidget(function(){
					UI.ED_DrawDiffMinimap(
						(sbar.x+sbar.w*0.5)*UI.pixels_per_unit,sbar.y*UI.pixels_per_unit,
						(sbar.w-sbar.w*0.5)*UI.pixels_per_unit,sbar.h*UI.pixels_per_unit,
						obj.sbar_diff_color,doc.m_diff_minimap);
				})
			}
			//if(doc.OnMouseWheel_real){
			//	doc.OnMouseWheel=doc.OnMouseWheel_real;
			//}else{
			//	doc.OnMouseWheel_real=doc.OnMouseWheel;
			//}
			if(is_find_mode_rendering){
				//find items scrollbar
				var ctx=obj.m_current_find_context;
				//the actual bar
				if(ctx){
					var srange=ctx.GetFindItemsScrollRange();
					if(srange[1]-srange[0]>0){
						var find_sbar_value=(ctx.m_find_scroll_visual_y-srange[0])/(srange[1]-srange[0]);
						W.ScrollBar("find_sbar",{x:obj.x+w_obj_area-obj.w_scroll_bar, y:y_scrolling_area, w:obj.w_scroll_bar, h:h_scrolling_area, dimension:'y',
							page_size:ctx.m_current_visual_h, total_size:(srange[1]-srange[0]), value:find_sbar_value,
							OnChange:function(value){
								ctx.m_find_scroll_visual_y=value*(srange[1]-srange[0])+srange[0];
								ctx.ValidateFindItemScroll()
								UI.Refresh()
							},
							icon_color:obj.scroll_bar_style.$.over.icon_color,
							style:obj.scroll_bar_style
						})
					}
				}
				//doc.OnMouseWheel=obj.find_bar_edit.OnMouseWheel.bind(obj.find_bar_edit);
			}else{
				//at-scrollbar bookmark marker
				var hc_bookmark=UI.GetCharacterHeight(obj.bookmark_font)
				var bm_ccnts=doc.m_rendering_bm_ccnts;
				if(bm_ccnts&&bm_ccnts.length){
					var bm_xys=doc.m_rendering_bm_xys;
					for(var i=0;i<bm_ccnts.length;i++){
						var y=Math.max(Math.min(bm_xys[i*2+1]/ytot,1),0)*sbar.h+sbar.y
						var id=bm_ccnts[i][0]
						UI.RoundRect({
							x:sbar.x, w:sbar.w,
							y:y-obj.bookmark_scroll_bar_marker_size*0.5,h:obj.bookmark_scroll_bar_marker_size,
							color:obj.bookmark_text_color})
						if(id>=0){
							UI.DrawChar(obj.bookmark_font,sbar.x+2,
								y-sbar.y>hc_bookmark?y-obj.bookmark_scroll_bar_marker_size*0.5-hc_bookmark:y+obj.bookmark_scroll_bar_marker_size*0.5,
								obj.bookmark_text_color,48+id)
						}
					}
				}
				//at-scrollbar error markers
				if(doc.m_error_overlays){
					var error_ccnts=[];
					for(var i=0;i<doc.m_error_overlays.length;i++){
						var err=doc.m_error_overlays[i];
						if(!err.is_in_active_doc){continue;}
						error_ccnts.push(err.sel_ccnt0.ccnt)
					}
					error_ccnts.sort(function(a,b){return a-b})
					var error_xys=doc.ed.GetXYEnMasse(error_ccnts)
					for(var i=0;i<error_xys.length;i+=2){
						var y=Math.max(Math.min(error_xys[i+1]/ytot,1),0)*sbar.h+sbar.y
						UI.RoundRect({
							x:sbar.x, w:sbar.w,
							y:y-obj.bookmark_scroll_bar_marker_size*0.5,h:obj.bookmark_scroll_bar_marker_size,
							color:doc.color_tilde_compiler_error})
					}
				}
				//the actual bar
				W.ScrollBar("sbar",{x:obj.x+w_obj_area-obj.w_scroll_bar, y:y_scrolling_area, w:obj.w_scroll_bar, h:h_scrolling_area, dimension:'y',
					page_size:h_scrolling_area, total_size:ytot, value:sbar_value,
					OnChange:function(value){
						doc.scroll_y=value*(this.total_size-this.page_size)
						doc.scrolling_animation=undefined
						UI.Refresh()
					},
					style:obj.scroll_bar_style
				})
				//at-scrollbar current page marker, show on mouseout to keep a consistent scale w.r.t. other markers
				var page_state_alpha=255-((obj.sbar.icon_color[0].color>>24)&0xff);
				if(page_state_alpha>0){
					var opacity=page_state_alpha/255
					var sbar_page_y0=Math.max(Math.min(doc.visible_scroll_y/ytot,1),0)*sbar.h+sbar.y
					var sbar_page_y1=Math.max(Math.min((doc.visible_scroll_y+h_scrolling_area)/ytot,1),0)*sbar.h+sbar.y
					var h_sbar_rendering=Math.max(sbar_page_y1-sbar_page_y0,obj.bookmark_scroll_bar_marker_size);
					if(!(h_sbar_rendering>obj.bookmark_scroll_bar_marker_size*2)){
						UI.DrawChar(obj.sbar_eye_font,
							sbar.x+sbar.w-UI.MeasureText(obj.sbar_eye_font,"眼").w-1,
							sbar_page_y0-sbar.y>hc_bookmark?sbar_page_y0-hc_bookmark:sbar_page_y1,
							UI.lerp_rgba(obj.sbar_page_shadow&0xffffff,obj.sbar_page_shadow,opacity),"眼".charCodeAt(0))
					}
					UI.RoundRect({
						x:sbar.x, y:sbar_page_y0-(h_sbar_rendering-(sbar_page_y1-sbar_page_y0))*0.5, w:sbar.w, h:h_sbar_rendering,
						color:UI.lerp_rgba(obj.sbar_page_shadow&0xffffff,obj.sbar_page_shadow,opacity)})
					//UI.RoundRect({
					//	x:sbar.x, y:sbar.y+sbar_page_y0, w:sbar.w, h:obj.sbar_page_border_width,
					//	color:UI.lerp_rgba(obj.sbar_page_border_color&0xffffff,obj.sbar_page_border_color,opacity)})
					//UI.RoundRect({
					//	x:sbar.x, y:sbar.y+sbar_page_y1-obj.sbar_page_border_width, w:sbar.w, h:obj.sbar_page_border_width,
					//	color:UI.lerp_rgba(obj.sbar_page_border_color&0xffffff,obj.sbar_page_border_color,opacity)})
				}
			}
			//vertical scrollbar separator
			UI.RoundRect({
				x:obj.x+w_obj_area-w_scrolling_area, y:y_scrolling_area,
				w:1, h:h_scrolling_area-(desc_x_scroll_bar?obj.w_scroll_bar-1:0),
				color:obj.separator_color})
		}
		if(UI.TestOption("function_info_at_the_cursor")){
			var fhctx=doc&&doc.m_fhint_ctx;
			var s_notification=(fhctx&&fhctx.s_notification);
			if(s_notification){
				if(!fhctx.m_cached_prt||s_notification!=fhctx.m_cached_text){
					fhctx.m_cached_prt=UI.ED_FormatRichText(
						Language.GetHyphenator(UI.m_ui_language),
						s_notification,4,obj.accands_w_brief,UI.default_styles.code_editor_notification.styles);
					fhctx.m_cached_text=s_notification;
				}
				var xy_fbrief=doc.ed.XYFromCcnt(fhctx.m_ccnt_fcall_word0);
				var ed_caret=doc.GetIMECaretXY();
				var x_fbrief=obj.x+w_line_numbers+xy_fbrief.x;
				var y_fbrief=obj.y+(Math.max(xy_fbrief.y,ed_caret.y)-doc.visible_scroll_y);
				var w_fbrief=fhctx.m_cached_prt.m_w_line+obj.accands_sel_padding*4;
				var h_fbrief=fhctx.m_cached_prt.m_h_text+obj.accands_sel_padding*4;
				//if(doc.m_ac_context&&doc.m_ac_context.m_n_cands>1&&!doc.m_is_help_page_preview){
				//	//we also have accands, gotta move it above
				//	y_fbrief-=h_fbrief;
				//}else{
				//	//just put it below
				//	y_fbrief+=hc;
				//}
				var hc=UI.GetCharacterHeight(doc.font);
				y_fbrief+=hc;
				UI.RoundRect({
					x:x_fbrief-obj.accands_shadow_size, y:y_fbrief,
					w:w_fbrief+obj.accands_shadow_size*2, h:h_fbrief+obj.accands_shadow_size,
					round:obj.accands_shadow_size,
					border_width:-obj.accands_shadow_size,
					color:obj.accands_shadow_color})
				UI.RoundRect({
					x:x_fbrief, y:y_fbrief,
					w:w_fbrief, h:h_fbrief,
					border_width:obj.accands_border_width,
					border_color:obj.accands_border_color,
					round:obj.accands_round,
					color:obj.accands_bgcolor_brief})
				UI.ED_RenderRichText(fhctx.m_cached_prt,s_notification,
					x_fbrief+obj.accands_sel_padding*2,y_fbrief+obj.accands_sel_padding*2)
			}
		}
		if(doc.m_ac_context&&doc.m_ac_context.m_n_cands>1&&!doc.m_is_help_page_preview){
			RenderACCands(obj,w_obj_area,h_obj_area);
		}
		//if(f_draw_accands){
		//	f_draw_accands();
		//	UI.HackCallback(f_draw_accands);
		//	f_draw_accands=undefined;
		//}
		if(UI.enable_timing){
			UI.TimingEvent("starting to draw notifications");
		}
		if(obj.m_notifications&&!obj.show_find_bar&&!doc.m_is_help_page_preview){
			//&&!UI.m_frame_is_invalid
			//we need to keep it alive
			UI.PushCliprect(obj.x,obj.y,w_obj_area,h_obj_area)
			W.ListView('notification_list',{
				x:obj.x+w_obj_area-w_scrolling_area-obj.w_notification-8,y:obj.y+4,w:obj.w_notification,h:h_obj_area-8,
				dimension:'y',layout_spacing:8,layout_align:'left',is_single_click_mode:1,no_region:1,no_clipping:1,
				item_template:{
					object_type:W.NotificationItem,
				},items:obj.m_notifications})
			UI.PopCliprect()
		}
		///////////////////////////////////////
		obj.m_is_rendering_good=1;
		if(doc){
			doc.CallHooks('render');
		}
	UI.End()
	if(UI.enable_timing){
		UI.TimingEvent("leaving CodeEditor");
	}
	//wiping
	current_find_context=undefined;
	return obj
}

var RemoveDocFromByFileList=function(doc,fn){
	var arr_ori=UI.g_editor_from_file[fn];
	if(arr_ori){
		var arr_new=arr_ori.filter(function(doc_i){return doc_i!=doc})
		if(arr_new.length<arr_ori.length){
			UI.g_editor_from_file[fn]=(arr_new.length?arr_new:undefined);
			return 1;
		}
	}
	return 0;
};

var AddDocToByFileList=function(doc,fn){
	var arr_ori=(UI.g_editor_from_file[fn]||[]);
	arr_ori.push(doc);
	UI.g_editor_from_file[fn]=arr_ori;
};

//UI.DetectRepository=DetectRepository;
var g_new_id=0;
var g_tab_appeared_names={arv:{},objs:{}};
UI.GetSmartTabName=function(fn){
	if(fn.length&&fn[0]=='*'){
		return UI.RemovePath(fn);
	}
	var obj=g_tab_appeared_names.objs[fn];
	if(!obj){
		obj={name:fn};
		g_tab_appeared_names.objs[fn]=obj;
	}
	return GetSmartFileName(g_tab_appeared_names.arv,obj);
}
UI.NewCodeEditorTab=function(fname0){
	//var file_name=fname0||IO.GetNewDocumentName("new","txt","document")
	var file_name=fname0||("<New #"+(g_new_id++).toString()+">")
	DetectRepository(file_name)
	UI.top.app.quit_on_zero_tab=0;
	return UI.NewTab({
		file_name:file_name,
		title:UI.GetSmartTabName(file_name),
		document_type:'text',
		tooltip:file_name,
		opening_callbacks:[],
		NeedRendering:function(){
			if(!this.main_widget){return 1;}
			if(this==UI.top.app.document_area.active_tab){return 1;}
			return !this.main_widget.m_is_rendering_good;
		},
		UpdateTitle:function(){
			var doc=(this.main_widget&&this.main_widget.doc);
			var fn_display=(doc&&doc.m_file_name||this.file_name)
			var arr_editors=UI.g_editor_from_file[fn_display];
			if(fn_display.length&&fn_display[0]=='*'){
				var special_file_desc=UI.m_special_files[fn_display.substr(1)];
				if(special_file_desc&&special_file_desc.display_name){
					fn_display=special_file_desc.display_name;
				}
			}else{
				fn_display=IO.NormalizeFileName(fn_display,1);
			}
			this.title=UI.GetSmartTabName(fn_display);
			if(arr_editors&&arr_editors.length>1){
				var dup_id=undefined;
				var cur_dup_id=0;
				for(var i=0;i<arr_editors.length;i++){
					if(!(arr_editors[i].owner&&arr_editors[i].owner.is_a_tab)){
						continue;
					}
					if(arr_editors[i]==doc){
						dup_id=cur_dup_id;
						//break;
					}
					cur_dup_id++;
				}
				if(dup_id!=undefined&&cur_dup_id>1){
					this.title=this.title+':'+(dup_id+1).toString();
				}
			}
			this.tooltip=fn_display;
			this.need_save=0
			if(doc&&(doc.saved_point||0)!=doc.ed.GetUndoQueueLength()){
				this.title=this.title+'*'
				this.need_save=1
			}
		},
		body:function(){
			//use styling for editor themes
			UI.context_parent.body=this.main_widget;
			if(this.main_widget){this.file_name=this.main_widget.file_name}
			var attrs={
				'anchor':'parent','anchor_align':"fill",'anchor_valign':"fill",
				'x':0,'y':0,
				'w_tab':UI.context_parent.w,'h_tab':UI.context_parent.h,
				'file_name':this.file_name,
				'is_a_tab':1,
			};
			if(!this.main_widget&&!fname0){
				if(this.is_options_window){
					attrs.m_is_special_document=1;
					//attrs.m_sxs_visualizer=W.SXS_OptionsPage;
					UI.InvalidateCurrentFrame();
				}else if(this.is_preview_window){
					attrs.m_is_special_document=1;
					UI.InvalidateCurrentFrame();
				}
			}
			var body=W.CodeEditor("body",attrs)
			if(!this.main_widget){
				this.main_widget=body;
			}
			var doc=body.doc;
			if(doc&&this.opening_callbacks.length){
				if(doc.m_finished_loading){
					var cbs=this.opening_callbacks
					if(cbs){
						for(var i=0;i<cbs.length;i++){
							cbs[i].call(doc);
						}
					}
				}else{
					doc.opening_callbacks=this.opening_callbacks
				}
				this.opening_callbacks=[]
			}
			//if(this.auto_focus_file_search&&body.sxs_visualizer&&body.sxs_visualizer.find_bar_edit){
			//	this.auto_focus_file_search=0
			//	UI.SetFocus(body.sxs_visualizer.find_bar_edit)
			//	body.sxs_visualizer.m_close_on_esc=1
			//	UI.Refresh()
			//}
			return body;
		},
		Save:function(){
			if(!this.main_widget){return;}
			if(this.main_widget.file_name&&this.main_widget.file_name.indexOf('<')>=0){
				this.SaveAs()
				return
			}
			this.main_widget.Save();
			this.need_save=0
			var doc=this.main_widget.doc;
			if(doc&&(doc.saved_point||0)<doc.ed.GetUndoQueueLength()){
				this.need_save=1
			}
		},
		SaveAs:function(){
			if(!this.main_widget){return;}
			if(UI.Platform.ARCH=="web"){
				var fn=(this.main_widget.file_name.indexOf('<')>=0?"untitled.txt":UI.RemovePath(this.main_widget.file_name));
				var s_script=[
					"(function(){",
					"  var element = document.createElement('a');",
					"  element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(",
						JSON.stringify(this.main_widget.doc.ed.GetText()),
					"));",
					"  element.setAttribute('download', ",JSON.stringify(fn),");",
					"  element.style.display = 'none';",
					"  document.body.appendChild(element);",
					"  element.click();",
					"  document.body.removeChild(element);",
					"})();"].join('');
				UI.EmscriptenEval(s_script);
				return;
			}
			var fn=IO.DoFileDialog(1,undefined,
				this.main_widget.file_name.indexOf('<')>=0?
					UI.m_new_document_search_path:
					UI.GetPathFromFilename(this.main_widget.file_name));
			if(!fn){return;}
			fn=IO.NormalizeFileName(fn);
			var doc=this.main_widget.doc;
			if(doc){
				if(RemoveDocFromByFileList(doc,doc.m_file_name)){
					AddDocToByFileList(doc,fn);
				}
				//if(UI.g_editor_from_file[doc.m_file_name]==doc){
				//	UI.g_editor_from_file[doc.m_file_name]=undefined;
				//	UI.g_editor_from_file[fn]=doc;
				//}
				doc.m_file_name=fn;
				doc.m_language_id=Language.GetNameByExt(UI.GetFileNameExtension(fn));
			}
			this.file_name=fn
			this.main_widget.file_name=fn
			this.Save()
		},
		SaveMetaData:function(){
			if(this.main_widget){this.main_widget.SaveMetaData();}
		},
		OnDestroy:function(){
			if(this.main_widget){this.main_widget.OnDestroy();}
		},
		Reload:function(){
			if(this.main_widget){this.main_widget.Reload();}
		},
		OnTabActivate:function(){
			//bring up the notebook if available
			if(UI.TestOption("notebook_autoswitch")){
				var spath_repo=UI.GetEditorProject(this.file_name,"polite");
				if(spath_repo){
					var fn_notebook=IO.NormalizeFileName(spath_repo+"/notebook.json");
					UI.BringUpNotebookTab(fn_notebook,"bringup");
					this.z_order=UI.g_current_z_value;
					UI.g_current_z_value++;
					UI.RefreshAllTabs();
				}
			}
		},
		//color_theme:[UI.Platform.BUILD=="debug"?0xff1f1fb4:0xffb4771f],
	})
};

UI.OpenEditorWindow=function(fname,fcallback,is_quiet){
	if(!(fname&&fname[0]=='*')){
		fname=IO.NormalizeFileName(fname).replace(/[\\]/g,"/");
		if(fname){
			UI.BumpHistory(fname);
			//console.log('BumpHistory',fname)
		}
	}
	if(is_quiet!='restore_workspace'){
		var obj_tab=undefined;
		for(var i=0;i<UI.g_all_document_windows.length;i++){
			if(UI.g_all_document_windows[i].file_name==fname){
				obj_tab=UI.g_all_document_windows[i]
				if(!is_quiet){
					UI.top.app.document_area.SetTab(i)
				}
				break
			}
		}
	}
	if(!obj_tab){
		var bk_current_tab_id=undefined;
		if(is_quiet){
			bk_current_tab_id=UI.top.app.document_area.current_tab_id;
		}
		var lang=UI.ED_GetFileLanguage(fname);
		if(lang.is_binary){
			obj_tab=UI.NewBinaryEditorTab(fname)
		}else{
			obj_tab=UI.NewCodeEditorTab(fname)
		}
		if(is_quiet){
			UI.top.app.document_area.current_tab_id=bk_current_tab_id;
		}
	}
	if(fcallback){
		if(obj_tab.main_widget&&obj_tab.main_widget.doc){
			fcallback.call(obj_tab.main_widget.doc)
		}else{
			if(obj_tab.opening_callbacks){
				obj_tab.opening_callbacks.push(fcallback)
			}
		}
	}
	return obj_tab;
}

UI.OpenForCommandLine=function(cmdline_opens){
	for(var i=0;i<cmdline_opens.length;i++){
		if(i+2<cmdline_opens.length&&cmdline_opens[i+1]=='--seek'){
			var line=Math.max(parseInt(cmdline_opens[i+2])-1,0);
			UI.OpenEditorWindow(cmdline_opens[i],function(){
				if(!(line>=0)){
					return;
				}
				var doc=this
				var ccnt=doc.SeekLC(line,0)
				doc.SetSelection(ccnt,ccnt)
				doc.AutoScroll("center")
				UI.g_cursor_history_test_same_reason=1
				UI.Refresh()
			})
			i+=2;
			continue;
		}
		UI.OpenEditorWindow(cmdline_opens[i])
	}
}

UI.OnApplicationSwitch=function(){
	var fn_hack_pipe2=IO.GetStoragePath()+"/tmp_open.json";
	if(IO.FileExists(fn_hack_pipe2)){
		try{
			var cmdline_opens=JSON.parse(IO.ReadAll(fn_hack_pipe2));
			IO.DeleteFile(fn_hack_pipe2)
			UI.OpenForCommandLine(cmdline_opens);
			UI.Refresh();
		}catch(e){
			//do nothing
		}
	}
	////////////////////
	//todo: unshown editors?
	for(var i=0;i<UI.g_all_document_windows.length;i++){
		var obj_tab=UI.g_all_document_windows[i]
		if(obj_tab.main_widget&&obj_tab.main_widget.doc){
			//coulddo: more reliable class test
			var obj=obj_tab.main_widget
			CheckEditorExternalChange(obj);
		}else if(obj_tab.main_widget&&obj_tab.document_type=='notebook'){
			var obj_notebook=obj_tab.main_widget;
			if(obj_notebook.m_loaded_time!=IO.GetFileTimestamp(obj_notebook.file_name)){
				var obj_notification_receiver=obj_notebook["doc_in_0"];
				if(!IO.FileExists(obj_notebook.file_name)){
					//make a notification
					if(obj_notification_receiver){
						obj_notification_receiver.CreateNotification({id:'saving_progress',icon:'警',text:"IT'S DELETED!\nSave your changes to dismiss this"})
					}
					obj_notebook.need_save|=2;
				}else if(obj_tab.need_save){
					//make a notification
					if(obj_notification_receiver){
						obj_notification_receiver.CreateNotification({id:'saving_progress',icon:'警',text:"FILE CHANGED OUTSIDE!\n - Use File-Revert to reload\n - Save your changes to dismiss this"})
					}
					obj_notebook.need_save|=2;
				}else{
					//what is reload? nuke it
					obj_notebook.Reload()
				}
				//loaded time
			}
		}
	}
}

///////////////////////////
UI.g_cursor_history_undo=[];
UI.g_cursor_history_redo=[];
UI.g_cursor_history_test_same_reason=0;
UI.SetSelectionEx=function(doc,ccnt0,ccnt1,sreason){
	var prev_ccnt0=doc.sel0.ccnt
	var prev_ccnt1=doc.sel1.ccnt
	if(prev_ccnt0!=ccnt0||prev_ccnt1!=ccnt1){
		UI.RecordCursorHistroy(doc,sreason)
	}
	doc.SetSelection(ccnt0,ccnt1)
	UI.g_cursor_history_test_same_reason=1
}

UI.RecordCursorHistroy=function(doc,sreason){
	UI.g_cursor_history_redo=[]
	if(UI.g_cursor_history_test_same_reason&&UI.g_cursor_history_undo.length&&UI.g_cursor_history_undo[UI.g_cursor_history_undo.length-1].sreason==sreason){
		//merge same-reason records
		//UI.g_cursor_history_undo.pop()
		return;
	}
	var prev_ccnt0=doc.sel0.ccnt
	var prev_ccnt1=doc.sel1.ccnt
	UI.g_cursor_history_undo.push({file_name:doc.m_file_name,ccnt0:prev_ccnt0,ccnt1:prev_ccnt1,sreason:sreason})
	//print(JSON.stringify(UI.g_cursor_history_undo))
	UI.g_cursor_history_test_same_reason=1
}

UI.ForgetFile=function(obj_fileitem){
	var fname=obj_fileitem.name
	//wipe its own history
	UI.m_ui_metadata["<history>"]=UI.m_ui_metadata["<history>"].filter(function(a){return a!=fname})
	if(UI.m_ui_metadata[fname]){
		delete UI.m_ui_metadata[fname]
	}
	//wipe the tab-switching history from other files
	var hist=UI.m_ui_metadata["<history>"]
	for(var i=0;i<hist.length;i++){
		var metadata=UI.m_ui_metadata[hist[i]]
		if(metadata&&metadata.m_tabswitch_count){
			if(metadata.m_tabswitch_count[fname]){
				var n=metadata.m_tabswitch_count[fname]
				delete metadata.m_tabswitch_count[fname]
				metadata.m_tabswitch_count["$"]-=n;
			}
		}
	}
	//refresh
	var obj_newpage=obj_fileitem.owner
	obj_newpage.m_file_list=undefined
	UI.Refresh()
}

UI.ED_IndexGC=function(){
	UI.ED_IndexGCBegin()
	for(var i=0;i<UI.g_all_document_windows.length;i++){
		var obj_tab=UI.g_all_document_windows[i]
		if(obj_tab.main_widget&&obj_tab.main_widget.doc&&!obj_tab.main_widget.m_is_preview){
			UI.ED_IndexGCMark(obj_tab.main_widget.file_name);
		}
	}
	UI.ED_IndexGCEnd()
}

UI.FillLanguageMenu=function(s_ext,language_id,f_set_language_id){
	var menu_lang=UI.BigMenu("&Language")
	var langs=Language.m_all_languages
	var got_separator=0
	langs.sort(function(a,b){
		a=(a.name_sort_hack||a.name);
		b=(b.name_sort_hack||b.name);
		return a>b?1:(a<b?-1:0);
	})
	var default_language_id=Language.GetNameByExt(s_ext)
	if(language_id==undefined){language_id=default_language_id;}
	for(var i=0;i<langs.length;i++){
		if(!got_separator&&!langs[i].name_sort_hack){
			menu_lang.AddSeparator()
			got_separator=1
		}
		menu_lang.AddNormalItem({
			text:langs[i].name,
			enable_hotkey:0,
			key:default_language_id==langs[i].name?"\u2605":undefined,
			icon:(language_id==langs[i].name)?"对":undefined,
			action:function(name,s_ext,is_selected,is_default){
				if(is_selected&&!is_default){
					UI.m_ui_metadata["<language_assoc>"][s_ext]=name;
				}
				f_set_language_id(name)
				UI.Refresh();
			}.bind(undefined,langs[i].name,s_ext,language_id==langs[i].name,default_language_id==langs[i].name)})
	}
}

Language.Register({
	name_sort_hack:" Plain Text",name:"Plain text",parser:"text",
	enable_dictionary:1,
	rules:function(lang){
		lang.DefineDefaultColor("color")
		return function(){}
	}
})

Language.Register({
	name_sort_hack:' Binary blob',name:'Binary',parser:'none',
	is_binary:1,
	extensions:[
		'bin',
		'bz2','zip',
		'exe','dll','lib','o',
		"png","jpg","jpeg", "gif","tif","tiff", "bmp","ppm","webp","ico", "tga","dds","exr","iff","pfm","hdr",
		"mp4","mpg","mpeg","h264","avi","mov","rm","rmvb",
		'ttf','otf',
		'pdb','sdf',
		'svn-base'],
	////////////////////////
	rules:function(lang){
		lang.DefineDefaultColor("color")
		return function(){}
	}
});

//language selection
UI.RegisterEditorPlugin(function(){
	if(this.plugin_class!="code_editor"||!this.m_is_main_editor){return;}
	this.AddEventHandler('menu',function(){
		UI.FillLanguageMenu(UI.GetFileNameExtension(this.m_file_name),this.m_language_id,(function(name){
			if(name==this.m_language_id){return;}
			this.m_language_id=name;
			if(this.notebook_owner){
				var desc=Language.GetDescObjectByName(name);
				if(desc.is_binary){return;}
				this.notebook_owner.UpdateLanguage(this.m_cell_id,name);
				return;
			}
			//try to reload
			if(this.owner.file_name.indexOf('<')>=0&&!Language.GetDescObjectByName(name).is_binary){
				//new file
				this.owner.SaveMetaData("forced");
				var s_text_bak=this.ed.GetText();
				this.owner.Reload();
				this.owner.doc=UI.OpenCodeEditorDocument(this.owner.file_name,this.owner.m_is_preview,name);
				this.owner.doc.Init();
				if(s_text_bak){
					this.owner.doc.ed.Edit([0,0,s_text_bak]);
				}
			}else if((this.saved_point||0)!=this.ed.GetUndoQueueLength()||this.ed.saving_context){
				//make a notification
				this.owner.CreateNotification({id:'language_reload_warning',text:"Save the file for the language change to take effect"})
				this.saved_point=-1;
			}else{
				//what is reload? nuke it
				this.owner.SaveMetaData("forced");
				if(Language.GetDescObjectByName(name).is_binary){
					var fn=this.owner.file_name;
					UI.top.app.document_area.just_created_a_tab=1;
					UI.top.app.document_area.CloseTab();
					UI.OpenEditorWindow(fn);
				}else{
					this.owner.Reload()
				}
			}
		}).bind(this))
	})
});

UI.RegisterEditorPlugin(function(){
	if(this.plugin_class!="code_editor"||!this.m_is_main_editor){return;}
	this.AddEventHandler('userTypeChar',function(){
		if(this.m_ac_activated){
			if(this.TestAutoCompletion("explicit")){
				//var acctx=this.m_ac_context;
				//if(acctx&&acctx.m_accands.m_common_prefix){
				//	this.ConfirmAC(undefined);
				//}
				return;
			}
		}else{
			this.TestAutoCompletion()
		}
	})
	this.AddEventHandler('change',function(){
		this.m_ac_context=undefined;
		//this.CancelAutoCompletion()
	})
	this.AddEventHandler('TAB',function(){
		if(this.TestAutoCompletion("explicit")){
			var acctx=this.m_ac_context;
			if(acctx&&acctx.m_accands.m_common_prefix){
				this.ConfirmAC(undefined);
				return 0;
			}
			this.ActivateAC()
			return 0;
		}
		return 1
	})
}).prototype.desc={category:"Editing",name:"Auto-completion",stable_name:"auto_completion"};

UI.RegisterEditorPlugin(function(){
	if(this.plugin_class!="code_editor"||!this.m_is_main_editor){return;}
	//doesn't make sense to disable this right now
	this.AddEventHandler('change',function(){
		var renderer=this.ed.GetHandlerByID(this.ed.m_handler_registration["renderer"]);
		renderer.HunspellClearContext();
	})
	this.AddEventHandler('selectionChange',function(){
		this.CancelAutoCompletion()
		if(this.m_fhint_ctx){
			var fhctx=this.m_fhint_ctx;
			if(fhctx.m_ccnt_fcall_bracket<=this.sel1.ccnt&&this.sel1.ccnt<=fhctx.m_ccnt_rbracket){
				//leave it be
				this.TestFunctionHint();
			}else{
				this.m_fhint_ctx=undefined;
			}
		}else{
			this.m_fhint_ctx=undefined;
		}
		this.m_ac_activated=0
		this.TestCorrection();
	})
})//.prototype.desc={category:"Editing",name:"Auto-completion",stable_name:"auto_completion"};

UI.RegisterEditorPlugin(function(){
	if(this.plugin_class!="code_editor"||!this.m_is_main_editor){return;}
	this.AddEventHandler('userTypeChar',function(){
		this.TestFunctionHint()
	})
}).prototype.desc={category:"Display",name:"Show parameter hint",stable_name:"show_func_hint"};

UI.CustomizeConfigScript=function(fn){
	var fn_full=IO.GetStoragePath()+"/"+fn;
	if(!IO.FileExists(fn)){
		var s_content=undefined;
		if(fn=='theme.json'){
			var a_content=[];
			a_content.push('{\n');
			for(var k in UI.g_core_theme_template){
				a_content.push('\t"',k,'":',k=='is_light'?UI.g_core_theme_template[k]:JSON.stringify(UI.g_core_theme_template[k].toString(16)),',\n');
			}
			a_content.pop();
			a_content.push('\n}\n');
			s_content=a_content.join('');
		}else{
			s_content=IO.UIReadAll("res/misc/"+fn);
		}
		IO.CreateFile(fn_full,s_content);
	}
	UI.OpenEditorWindow(fn_full,function(){
		if(fn=='theme.json'){
			//coulddo: "reset to default" in right-click menu - delete the file and re-generate it
			this.m_event_hooks['save']=[function(){
				UI.ApplyTheme(UI.CustomTheme());
				if(this.owner){
					if(UI.g_theme_parsing_error){
						this.owner.CreateNotification({id:'theme_error',icon:'警',text:UI._("Bad theme:\n  ")+UI.g_theme_parsing_error});
						var match=UI.g_theme_parsing_error.match(/at offset ([0-9]+)/);
						if(match){
							var ccnt=Math.min(Math.max(parseInt(match[1])-1,0),this.ed.GetTextSize());
							this.SetSelection(ccnt,ccnt);
						}
					}else{
						this.owner.DismissNotification('theme_error');
					}
				}
				UI.RefreshAllTabs();
			}];
		}
	})
}

W.FeatureItem=function(id,attrs){
	var obj=UI.Keep(id,attrs)
	UI.StdStyling(id,obj,attrs, "feature_item");
	if(obj.is_first){
		obj.h=obj.h_first;
	}else{
		obj.h=obj.h_normal;
	}
	if(obj.h_special){obj.h+=obj.h_special;}
	UI.StdAnchoring(id,obj);
	UI.Begin(obj)
		obj.editor_widget=obj.owner.owner;
		//default-enable everything
		var options=UI.m_ui_metadata["<options>"];
		if(obj.is_first){
			var h_caption=obj.h_first-obj.h_normal;
			UI.RoundRect({
				x:obj.x-obj.caption_shadow_size,y:obj.y+h_caption-obj.caption_shadow_size,w:obj.w-12+obj.caption_shadow_size,h:obj.caption_shadow_size*2,
				color:obj.caption_shadow_color,
				round:obj.caption_shadow_size,
				border_width:-obj.caption_shadow_size,
			})
			UI.RoundRect({
				x:obj.x,y:obj.y,w:obj.w-12,h:h_caption,
				color:obj.caption_color,border_color:obj.caption_border_color,
				border_width:obj.caption_border_width,
			})
			W.Text("",{
				x:obj.x+8,y:obj.y+(h_caption-UI.GetCharacterHeight(obj.caption_icon_font))*0.5,
				font:obj.caption_icon_font,text:obj.category_icon,color:obj.caption_icon_color})
			W.Text("",{
				x:obj.x+32+8,y:obj.y+(h_caption-UI.GetCharacterHeight(obj.caption_font))*0.5-2,
				font:obj.caption_font,text:obj.category,color:obj.caption_text_color})
		}
		if(obj.name){
			var is_enabled=options[obj.stable_name];
			if(is_enabled==undefined){is_enabled=1;}
			W.Text("",{x:obj.x+16,y:obj.y+obj.h-27,font:obj.icon_fontb,text:is_enabled?"■":"□",color:obj.icon_color})
			W.Text("",{x:obj.x+40,y:obj.y+obj.h-32,font:obj.font,text:obj.name,color:obj.text_color})
			W.Region("checkbox_"+obj.stable_name,{
				x:obj.x,y:obj.y+obj.h-32,w:obj.w-12,h:32,
				OnClick:(function(new_value){
					options[obj.stable_name]=new_value;
					if(obj.editor_widget){
						obj.editor_widget.Reload();
					}
					UI.RefreshAllTabs()
				}).bind(undefined,!is_enabled),
				OnMouseWheel:function(event){
					obj.owner.features_list.OnMouseWheel(event);
				},
			})
		}else if(obj.license_line){
			W.Text("",{x:obj.x+16,y:obj.y+obj.h-32,font:obj.font,text:obj.license_line,color:obj.text_color_license})
		}else if(obj.special){
			if(obj.special=='install_button'){
				var s_text=UI._("Install shell menu integration")
				var dims=UI.MeasureText(obj.font,s_text);
				W.Button("install_button",{x:obj.x+12,y:obj.y+obj.h-34,w:dims.w+28+8,h:32,text:"",
					OnMouseWheel:function(event){
						obj.owner.features_list.OnMouseWheel(event);
					},
					OnClick:function(){
						UI.InstallQPad();
					},
				})
				W.Text("",{x:obj.x+16,y:obj.y+obj.h-29,font:obj.icon_font,text:"盾",color:obj.install_button.text_color})
				W.Text("",{x:obj.x+40,y:obj.y+obj.h-34,font:obj.font,text:s_text,color:obj.install_button.text_color})
			}else if(obj.special=='theme_button'){
				var s_text=UI._("Dark theme / light theme")
				var dims=UI.MeasureText(obj.font,s_text);
				W.Button("dark_light_theme",{x:obj.x+12,y:obj.y+obj.h-34,w:dims.w+28+8,h:32,text:"",
					OnMouseWheel:function(event){
						obj.owner.features_list.OnMouseWheel(event);
					},
					OnClick:function(){
						options["use_light_theme"]=!UI.TestOption("use_light_theme");
						UI.ApplyTheme(UI.CustomTheme())
						if(obj.editor_widget){
							obj.editor_widget.Reload();
						}
						obj.owner.plugin_view_items=undefined;
						UI.RefreshAllTabs()
					}
				})
				W.Text("",{x:obj.x+16,y:obj.y+obj.h-29,font:obj.icon_font,text:"半",color:obj.dark_light_theme.text_color})
				W.Text("",{x:obj.x+40,y:obj.y+obj.h-34,font:obj.font,text:s_text,color:obj.dark_light_theme.text_color})
			}else if(obj.special=='tab_width'){
				var s_text_0=UI.GetOption("tab_width",4).toString();
				var s_text=UI._("Adjust tab width")
				var dims0=UI.MeasureText(obj.font_small,s_text_0);
				var dims=UI.MeasureText(obj.font,s_text);
				W.Button("tab_width_btn",{x:obj.x+12,y:obj.y+obj.h-34,w:dims.w+28+8,h:32,text:"",
					OnMouseWheel:function(event){
						obj.owner.features_list.OnMouseWheel(event);
					},
					OnClick:function(){
						var twidth=UI.GetOption("tab_width",4);
						twidth+=2;
						if(!(twidth<12)){twidth=2;}
						options["tab_width"]=twidth;
						if(obj.editor_widget){
							obj.editor_widget.Reload();
						}
						UI.RefreshAllTabs()
					}
				})
				W.Text("",{x:obj.x+16+(20-dims0.w)*0.5,y:obj.y+obj.h-34+(28-dims0.h)*0.5,font:obj.font_small,text:s_text_0,color:obj.tab_width_btn.text_color})
				W.Text("",{x:obj.x+40,y:obj.y+obj.h-34,font:obj.font,text:s_text,color:obj.tab_width_btn.text_color})
			}else if(obj.special=='customize'){
				var s_text=obj.text;
				var dims=UI.MeasureText(obj.font,s_text);
				var btn=W.Button("customize_"+obj.file,{x:obj.x+12,y:obj.y+obj.h-34,w:dims.w+28+8,h:32,text:"",
					OnMouseWheel:function(event){
						obj.owner.features_list.OnMouseWheel(event);
					},
					OnClick:function(){
						UI.CustomizeConfigScript(obj.file)
					}
				})
				W.Text("",{x:obj.x+16,y:obj.y+obj.h-29,font:obj.icon_font,text:"换",color:btn.text_color})
				W.Text("",{x:obj.x+40,y:obj.y+obj.h-34,font:obj.font,text:s_text,color:btn.text_color})
			}
		}
	UI.End()
	return obj
}

W.OptionsPage=function(id,attrs){
	var obj=UI.StdWidget(id,attrs,"sxs_options_page");
	var options=UI.m_ui_metadata["<options>"];
	if(!options){
		options={};
		UI.m_ui_metadata["<options>"]=options;
	}
	UI.Begin(obj)
		UI.RoundRect(obj)
		W.Region('wheel_area',{
			x:obj.x,y:obj.y,w:obj.w,h:obj.h,
			OnMouseWheel:function(event){
				obj.features_list.OnMouseWheel(event);
			},
		})
		//just a bunch of checkboxes in a listview
		//editor plugins, plugin files, install
		if(!obj.plugin_view_items){
			/////////////////
			//special stuff
			var plugin_items={};
			plugin_items["Display"]=[
				{special:'theme_button',h_special:4},
				{special:'tab_width',h_special:4},
				{name:'Use English (need to restart)',stable_name:'force_english'},//DO NOT TRANSLATE THIS!
				{name:UI._('Highlight the current line'),stable_name:'show_line_highlight'},
				{name:UI._('Highlight find at the scrollbar'),stable_name:'show_at_scrollbar_find_minimap'},
				{name:UI._('Highlight same-project tabs'),stable_name:'use_tab_alphas'},
				{name:UI._('Show the menu bar'),stable_name:'always_show_menu'},
				{name:UI._('Show horizontal scroll-bar'),stable_name:'show_x_scroll_bar'},
				{name:UI._('Show outer scope overlays'),stable_name:'show_top_hint'},
				{name:UI._('Show line numbers'),stable_name:'show_line_numbers'},
				{name:UI._('Show minimap'),stable_name:'show_minimap'},
				{name:UI._('Auto-hide minimap'),stable_name:'auto_hide_minimap'},
				{name:UI._('Auto-hide the "Files" tab'),stable_name:'auto_hide_filetab'},
				{name:UI._('Place function info at the cursor'),stable_name:'function_info_at_the_cursor'},
			];
			plugin_items["Controls"]=[
				{special:'customize',h_special:4,text:UI._("Customize the key mapping script"),file:"conf_keymap.js"},
				{name:UI._('Make @1 stop at both sides').replace("@1",UI.Platform.ARCH=="mac"?"\u2325\u2190/\u2325\u2192":"CTRL+\u2190/\u2192"),stable_name:'precise_ctrl_lr_stop'},
				{name:UI._('Allow \u2190/\u2192 to cross lines'),stable_name:'left_right_line_wrap'},
				{name:UI._('Move forward old tabs when manually opened'),stable_name:'explicit_open_mtf'},
				{name:UI._('Automatically close stale tabs'),stable_name:'close_stale'},
				{name:UI._('Auto-switch notebooks'),stable_name:'notebook_autoswitch'},
			];
			plugin_items["Tools"]=[];
			if(UI.InstallQPad){
				plugin_items["Tools"].push({special:'install_button',h_special:8})
			}
			if(UI.ShowCompletionNotification){
				plugin_items["Tools"].push({name:UI._('Notify when a notebook cell completes'),stable_name:'completion_notification'})
			}
			/////////////////
			//plugin options
			for(var i=0;i<UI.m_editor_plugins.length;i++){
				var desc_i=UI.m_editor_plugins[i].prototype.desc;
				if(!desc_i){continue;}
				desc_i=JSON.parse(JSON.stringify(desc_i));
				var cat_list=plugin_items[desc_i.category];
				if(!cat_list){
					cat_list=[];
					plugin_items[desc_i.category]=cat_list;
				}
				desc_i.name=UI._(desc_i.name);
				cat_list.push(desc_i);
			}
			plugin_items["Display"].push(
				{name:UI._('Create FBO for linear rendering'),stable_name:'software_srgb'},
				{name:UI._('Enable smart repainting'),stable_name:'enable_smart_tab_repainting'},
				{special:'customize',h_special:4,text:UI._("Customize the theme"),file:"theme.json"},
				{special:'customize',h_special:4,text:UI._("Customize the translation script"),file:"conf_translation.js"}
			);
			/////////////////
			//qpad credits
			plugin_items["About"]=[
				{license_line:UI.Format("QPad v@1, by Qiming HOU",UI.g_version),text_color_license:UI.default_styles.feature_item.text_color},
				{license_line:UI._("Contact: hqm03ster@gmail.com"),text_color_license:UI.default_styles.feature_item.text_color},
				{license_line:UI.Format("Commit: @1",UI.g_commit)},
			];
			/////////////////
			//OSS licenses
			plugin_items["Open Source Licenses"]=[
				{license_line:"stb: Public domain, authored from 2009-2013 by Sean Barrett"},
				{license_line:"SDL: Copyright (C) 1997-2014 Sam Lantinga <slouken@libsdl.org>"},
				{license_line:"duktape: Copyright (c) 2013-2015 by Duktape authors"},
				{license_line:"Hunspell: Copyright (c) N\u00e9meth L\u00e1szl\u00f3"},
				{license_line:"Native File Dialog by Michael Labbe mike@frogtoss.com"},
			];
			plugin_items["Font Licenses"]=[
				{license_line:"Open Sans: Digitized data copyright © 2010-2011, Google Corporation"},
				{license_line:"Inconsolata: Copyright (c) 2006-2012, Raph Levien (Raph.Levien@gmail.com)"},
				{license_line:"    Copyright (c) 2011-2012, Cyreal (cyreal.org)",h_special:-12},
				{license_line:"Computer Modern: Copyright (c) Authors of original metafont fonts"},
				{license_line:"    Copyright (c) 2003-2009, Andrey V. Panov (panov@canopus.iacp.dvo.ru)",h_special:-12},
			];
			if(UI.Platform.ARCH=="ios"||UI.Platform.ARCH=="web"){
				plugin_items["Font Licenses"].push(
					{license_line:"Droid Sans: Digitized data copyright © 2007, Google Corporation"});
			}
			/////////////////
			var view_items=[];
			for(var i=0;i<obj.categories.length;i++){
				var scat_i=obj.categories[i];
				var cat_list=plugin_items[scat_i];
				if(!cat_list){continue;}
				for(var j=0;j<cat_list.length;j++){
					var desc_i=cat_list[j];
					desc_i.is_first=(j==0);
					if(j==0){
						desc_i.category=UI._(scat_i);
						desc_i.category_icon=obj.category_icons[i];
					}
					view_items.push(desc_i);
				}
			}
			if(view_items.length){view_items[0].is_first=2;}
			for(var i=0;i<view_items.length;i++){
				view_items[i].h=(view_items[i].is_first?UI.default_styles.feature_item.h_first:UI.default_styles.feature_item.h_normal);
				if(view_items[i].h_special){
					view_items[i].h+=view_items[i].h_special;
				}
			}
			obj.plugin_view_items=view_items;
		}
		W.ListView('features_list',{
			x:obj.x,y:obj.y,w:obj.w-4,h:obj.h,
			mouse_wheel_speed:80,
			dimension:'y',layout_spacing:0,layout_align:'fill',
			is_single_click_mode:1,no_region:1,
			item_template:{
				object_type:W.FeatureItem,
				owner:obj,
			},items:obj.plugin_view_items})
		if(obj.activated){
			W.Hotkey("",{key:"ESC",action:function(){UI.top.app.document_area.CloseTab();}});
		}
	UI.End()
	return obj
}

UI.RegisterUtilType("preferences",function(){return UI.NewTab({
	title:UI._("Preferences"),
	area_name:"h_tools",
	body:function(){
		//frontmost doc
		UI.context_parent.body=this.util_widget;
		var tab_frontmost=undefined;
		for(var i=0;i<UI.g_all_document_windows.length;i++){
			var item_i=UI.g_all_document_windows[i];
			var name=(item_i.area_name||"doc_default");
			if(name.length<4||name.substr(0,4)!='doc_'){
				continue;
			}
			if(item_i.document_type=="text"&&item_i.main_widget&&item_i.main_widget.file_name=="*res/misc/example.cpp"){
				tab_frontmost=item_i;
			}
			item_i.__global_tab_id=i;
		}
		var obj_real=(tab_frontmost&&tab_frontmost.main_widget);
		//var had_body=!!this.util_widget;
		var body=W.OptionsPage('body',{
			'anchor':'parent','anchor_align':'fill','anchor_valign':'fill',
			'owner':obj_real,
			'activated':this==UI.top.app.document_area.active_tab,
			'x':0,'y':0});
		this.util_widget=body;
		//if(had_body&&!tab_frontmost){
		//	UI.m_invalid_util_tabs.push(this.__global_tab_id);
		//}
		return body;
	},
	Save:function(){},
	SaveMetaData:function(){},
	OnDestroy:function(){},
})});

UI.NewOptionsTab=function(){
	//for(var i=0;i<UI.g_all_document_windows.length;i++){
	//	if(UI.g_all_document_windows[i].is_options_window){
	//		var tab=UI.g_all_document_windows[i]
	//		UI.top.app.document_area.SetTab(i)
	//		return tab;
	//	}
	//}
	UI.OpenUtilTab('preferences');
	if(!UI.GetFrontMostEditorTab()){
		var tab=UI.OpenEditorWindow("*res/misc/example.cpp");
		tab.is_options_window=1
	}
	//tab.title=UI._("Preferences")
	//tab.file_name="*res/misc/example.cpp";
	return tab;
}

//////////////////////////////////////////////
//multi-file editing
UI.g_editor_from_file={};
UI.OpenCodeEditorDocument=function(fn,is_preview,language_id_override){
	if(fn&&fn.substr(0,1)!='*'){
		fn=IO.NormalizeFileName(fn);
	}
	///////////////////////////
	if(!is_preview){
		var arr_ori=UI.g_editor_from_file[fn];
		if(arr_ori){
			for(var i=0;i<arr_ori.length;i++){
				var doc=arr_ori[i];
				if(doc&&!doc.owner){
					doc.m_ed_refcnt++;
					return doc;
				}
			}
		}
	}
	var loaded_metadata=(fn&&UI.m_ui_metadata[fn]||{})
	var style=UI.default_styles.code_editor.editor_style;
	if(style.__proto__!=W.CodeEditor_prototype){
		style.__proto__=W.CodeEditor_prototype;
	}
	var s_ext=UI.GetFileNameExtension(fn)
	//need an initialization-time wrap width
	var language_id=(language_id_override||loaded_metadata.m_language_id||Language.GetNameByExt(s_ext))
	var wrap_width=(loaded_metadata.m_enable_wrapping?(loaded_metadata.m_current_wrap_width||((UI.IS_MOBILE||UI.Platform.ARCH=="web")?768:1024)):0);
	if(is_preview){
		wrap_width=1024;
	}
	var doc={
		///////////////
		language:Language.GetDefinitionByName(language_id),
		plugin_language_desc:Language.GetDescObjectByName(language_id),
		m_language_id:language_id,
		wrap_width:wrap_width,
		m_ed_refcnt:!is_preview,
		///////////////
		m_enable_wrapping:loaded_metadata.m_enable_wrapping,//for correct rendering
		m_is_preview:is_preview,
		m_file_name:fn,
		m_is_main_editor:1,
		precise_ctrl_lr_stop:UI.TestOption("precise_ctrl_lr_stop"),
		same_line_only_left_right:!UI.TestOption("left_right_line_wrap"),
		tab_width:UI.GetOption("tab_width",4),
	};
	doc.__proto__=style;
	if(!is_preview){
		AddDocToByFileList(doc,fn);
	}
	return doc;
};

UI.CreateEmptyCodeEditor=function(language_id){
	if(!language_id){language_id="Plain text";}
	var doc=UI.OpenCodeEditorDocument("",1,language_id);
	//doc.language=Language.GetDefinitionByName(language_id);
	//doc.plugin_language_desc=Language.GetDescObjectByName(language_id);
	//doc.m_language_id=language_id;
	doc.m_is_preview=0;
	return doc;
}

UI.CloseCodeEditorDocument=function(doc){
	doc.m_ed_refcnt--;
	if(!(doc.m_ed_refcnt>0)){
		var fn=doc.m_file_name;
		doc.OnDestroy();
		RemoveDocFromByFileList(doc,fn);
	}
}

////////////////////////////////////////////////
//project system
UI.AddProjectDir=function(spath){
	var projects=UI.m_ui_metadata["<projects>"];
	if(!projects){
		projects=[];
		UI.m_ui_metadata["<projects>"]=projects;
	}
	var spath=IO.NormalizeFileName(spath)
	for(var i=0;i<projects.length;i++){
		if(projects[i]==spath){
			return;
		}
	}
	projects.push(spath);
	UI.g_is_dir_a_project[spath]="permanent";
	UI.g_transient_projects=UI.g_transient_projects.filter(function(a){return a!=spath;})
	if(UI.m_current_file_list){
		var obj=UI.m_current_file_list.m_owner;
		if(obj){
			obj.m_file_list=undefined
			obj.m_try_to_focus=undefined;
			UI.Refresh()
		}
	}else{
		UI.ExplicitFileOpen()
	}
	var tab=UI.FindUtilTab("file_browser",0);
	if(tab){
		var obj=tab.util_widget;
		if(obj){
			obj.m_file_list=undefined
			obj.m_try_to_focus=undefined;
			UI.RefreshAllTabs()
		}
	}
	UI.RefreshAllTabs();
};

UI.RemoveProjectDir=function(spath){
	var projects=UI.m_ui_metadata["<projects>"];
	if(!projects){
		projects=[];
	}
	var spath=IO.NormalizeFileName(spath)
	UI.m_ui_metadata["<projects>"]=projects.filter(function(a){return a!=spath;})
	UI.g_is_dir_a_project[spath]="transient";
	UI.g_transient_projects.push(spath)
	if(UI.m_current_file_list){
		var obj=UI.m_current_file_list.m_owner;
		if(obj){
			obj.m_file_list=undefined
			obj.m_try_to_focus=undefined;
			UI.Refresh()
		}
	}
};

UI.g_is_dir_a_project={};
UI.g_transient_projects=[];
(function(){
	var projects=(UI.m_ui_metadata["<projects>"]||[]);
	for(var i=0;i<projects.length;i++){
		UI.g_is_dir_a_project[projects[i]]="permanent";
	}
})()

UI.RegisterSpecialFile("res/misc/example.cpp",{
	display_name:"Sandbox File",
});

UI.RegisterSpecialFile("project_list",{
	display_name:"Project List",
	Load:function(){
		var ret=[];
		var projects=(UI.m_ui_metadata["<projects>"]||[]);
		ret.push('*** Projects ***');
		for(var i=0;i<projects.length;i++){
			ret.push(projects[i])
		}
		if(UI.g_transient_projects.length>0){
			ret.push('*** Auto-detected repositories ***');
			UI.g_transient_projects.sort(function(a,b){
				a=UI.RemovePath(a);
				b=UI.RemovePath(b);
				if(a<b){return -1;}else{return a>b?1:0;}
			});
			for(var i=0;i<UI.g_transient_projects.length;i++){
				ret.push(UI.g_transient_projects[i])
			}
		}
		ret.push('')
		return ret.join('\n');
	},
	Save:function(stext){
		var files=stext.split('\n');
		var n_stars=0;
		var projects=[];
		UI.g_is_dir_a_project={};
		for(var i=0;i<files.length;i++){
			var fn=files[i];
			if(!fn){continue;}
			if(fn[0]=='*'){
				n_stars++;
				if(n_stars>1){break;}
				continue;
			}
			if(!IO.DirExists(fn)){continue;}
			projects.push(fn)
			UI.g_is_dir_a_project[fn]='permanent'
		}
		UI.m_ui_metadata["<projects>"]=projects;
		var tab=UI.FindUtilTab("file_browser",0);
		if(tab){
			var obj=tab.util_widget;
			if(obj){
				obj.m_file_list=undefined
				obj.m_try_to_focus=undefined;
				UI.RefreshAllTabs()
			}
		}
	},
});
//UI.enable_timing=1
//if(UI.StartupBenchmark){
//	console.log("--- code editor loaded")
//	UI.StartupBenchmark();
//}
