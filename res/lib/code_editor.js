//todo: long file list perf - "ready" state - begin/end auto-delete
//todo: degrading performance - could be AC
//could somehow optimize the current gui2d pipeline - the packing, *the vbo gen*: they are related
//cacheglyph for composite font
//wrap-around in search
var UI=require("gui2d/ui");
var W=require("gui2d/widgets");
require("res/lib/boxdoc");
require("res/lib/global_doc");
var Language=require("res/lib/langdef");
var MAX_PARSABLE=33554432
var TOK_TYPE=0x20000000
var KEY_DECL_CLASS=TOK_TYPE*0
var KEY_DECL_FUNCTION=TOK_TYPE*1;
var CALL_GC_DOC_SIZE_THRESHOLD=4194304;

if(!UI.m_ui_metadata.find_state){
	UI.m_ui_metadata.find_state={
		m_current_needle:"",
		m_find_flags:0,
	}
}

UI.m_code_editor_persistent_members=[
	//"m_current_needle",
	//"m_find_flags",
	"m_language_id",
	"m_current_wrap_width",
	"m_enable_wrapping",
	"m_hyphenator_name",
	"m_spell_checker",
	"m_tabswitch_count",
]
UI.m_code_editor_persistent_members_doc=[]
UI.RegisterCodeEditorPersistentMember=function(name){
	UI.m_code_editor_persistent_members_doc.push(name)
}
require("res/plugin/edbase");

UI.RegisterLoaderForExtension("*",function(fn){return UI.NewCodeEditorTab(fn)})

///////////////////////////////////////////////////////
//the code editor
W.CodeEditor_prototype=UI.InheritClass(W.Edit_prototype,{
	tab_is_char:1,
	plugin_class:'code_editor',
	state_handlers:["renderer_programmer","colorer_programmer","line_column_unicode","seeker_indentation"],
	//state_handlers:["renderer_fancy","colorer_programmer","line_column_unicode","seeker_indentation"],
	////////////////////
	//per-language portion
	//language:g_language_C,
	Init:function(){
		this.m_event_hooks={}
		this.m_event_hooks['load']=[]
		this.m_event_hooks['save']=[]
		this.m_event_hooks['parse']=[]
		this.m_event_hooks['menu']=[]
		this.m_event_hooks['beforeEdit']=[]
		//before creating the editor, try to call a language callback
		var loaded_metadata=(this.file_name&&UI.m_ui_metadata[this.file_name]||{})
		var hyp_name=(loaded_metadata.m_hyphenator_name||this.plugin_language_desc&&this.plugin_language_desc.default_hyphenator_name)
		if(hyp_name){
			this.hyphenator=Language.GetHyphenator(hyp_name)
			this.m_hyphenator_name=hyp_name
			this.font=this.tex_font
			this.font_emboldened=this.tex_font_emboldened
		}
		var spell_checker=(loaded_metadata.m_spell_checker||this.plugin_language_desc&&this.plugin_language_desc.spell_checker)
		if(spell_checker){
			this.m_spell_checker=spell_checker;
		}
		W.Edit_prototype.Init.call(this);
		//these are locators when set
		this.m_bookmarks=[undefined,undefined,undefined,undefined,undefined,undefined,undefined,undefined,undefined,undefined];
		this.m_unkeyed_bookmarks=[];
		if(this.m_is_main_editor){this.m_diff_from_save=this.ed.CreateDiffTracker()}
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
		ed.hfile_loading=UI.EDLoader_Open(ed,fn,is_preview?4096:(this.hyphenator?524288:16777216))
		//abandonment should work as is...
		var floadNext=(function(){
			if(this.m_is_destroyed){
				if(ed.hfile_loading){
					ed.hfile_loading.discard()
					ed.hfile_loading=undefined
				}
				return
			}
			ed.hfile_loading=UI.EDLoader_Read(ed,ed.hfile_loading,is_preview?16384:(this.hyphenator?131072:4194304))
			this.ResetSaveDiff()
			if(is_preview){
				var rendering_ccnt1=this.SeekXY(0,this.h)
				if(rendering_ccnt1<ed.GetTextSize()){
					//abandon and stop loading, without calling OnLoad
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
				this.ResetSaveDiff()
				this.owner.OnLoad()
			}
			UI.Refresh()
		}).bind(this)
		if(ed.hfile_loading){
			floadNext()
		}else{
			this.ResetSaveDiff()
			this.owner.OnLoad()
			if(!IO.FileExists(fn)&&!this.m_is_preview&&fn.indexOf('<')<0){
				this.saved_point=-1;
				this.owner.CreateNotification({id:'saving_progress',icon:'新',text:"Save to create the file"})
			}
		}
		UI.Refresh()
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
		return this.GetLC(Math.min(this.GetEnhancedHome(ccnt),ccnt))[1];
	},
	FindOuterIndentation:function(ccnt){
		var ed=this.ed;
		var id_indent=ed.m_handler_registration["seeker_indentation"]
		var my_level=this.GetIndentLevel(ccnt);
		return ed.FindNearest(id_indent,[my_level-1],"l",ccnt,-1);
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
			if(this.ed.GetText(side==0?ccnt:ccnt+1-lg,lg)==s){
				return lg
			}
		}
		return 1
	},
	FindOuterBracket_SizeFriendly:function(ccnt,delta){
		var ccnt_raw=this.FindOuterBracket(ccnt,delta)
		return delta<0?ccnt_raw:(ccnt_raw+1-this.BracketSizeAt(ccnt_raw,0))
	},
	FindOuterLevel:function(ccnt){
		var ret=Math.max(this.FindOuterBracket_SizeFriendly(ccnt,-1),this.FindOuterIndentation(ccnt))
		if(ret>=ccnt){ret=-1;}
		return ret
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
	SnapToValidLocation:function(ccnt,side){
		var ccnt_ret=W.Edit_prototype.SnapToValidLocation.call(this,ccnt,side)
		var renderer=this.ed.GetHandlerByID(this.ed.m_handler_registration["renderer"]);
		return renderer.SnapToShown(this.ed,ccnt_ret,side)
	},
	DrawEllipsis:function(x,y,scale,color){
		x/=UI.pixels_per_unit;
		y/=UI.pixels_per_unit;
		scale/=UI.pixels_per_unit;
		if(!this.m_ellipsis_font){
			this.m_ellipsis_font=UI.Font(UI.icon_font_name,this.h_ellipsis)
			this.m_ellipsis_delta_x=(this.w_ellipsis-UI.GetCharacterAdvance(this.m_ellipsis_font,0x2026))*0.5
			this.m_ellipsis_delta_y=(UI.GetCharacterHeight(this.font)-this.h_ellipsis)*0.5
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
})

W.MinimapThingy_prototype={
	dimension:'y',
	OnMouseDown:function(event){
		this.anchored_value=this.value
		this.anchored_xy=event.y
		UI.CaptureMouse(this)
	},
	OnMouseUp:function(event){
		UI.ReleaseMouse(this)
		this.anchored_value=undefined
		UI.Refresh()
	},
	OnMouseMove:function(event){
		if(this.anchored_value==undefined){return;}
		this.OnChange(Math.min(Math.max(this.anchored_value+(event.y-this.anchored_xy)/this.factor,0),1))
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

var g_re_regexp_escape=new RegExp("[\\-\\[\\]\\/\\{\\}\\(\\)\\*\\+\\?\\.\\\\\\^\\$\\|]","g")
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
		var dt_all=Duktape.__ui_seconds_between_ticks(UI.m_last_frame_tick,UI.m_frame_tick)
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
	var tmp={w:obj.w_text,h:1e17,font:obj.font,text:obj.text}
	UI.LayoutText(tmp);
	obj.w=obj.padding*2+obj.w_icon+obj.w_text
	obj.h=obj.padding*2+Math.max(obj.w_icon,tmp.h_text)
	UI.StdAnchoring(id,obj);
	UI.RoundRect({x:obj.x+obj.x_shake+obj.border_width,y:obj.y,w:obj.w+obj.shadow_size*0.75,h:obj.h+obj.shadow_size*0.75,
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
	if(obj.icon){UI.DrawChar(obj.icon_font,obj.x+obj.x_shake+obj.padding,obj.y+obj.padding,fadein(obj.icon_color,obj.alpha),obj.icon.charCodeAt(0))}
	UI.DrawTextControl(tmp,obj.x+obj.x_shake+obj.padding+obj.w_icon,obj.y+obj.padding,fadein(obj.text_color,obj.alpha))
	if(obj.OnClick){
		W.PureRegion(id,obj)
	}
	return obj
}

UI.SEARCH_FLAG_CASE_SENSITIVE=1;
UI.SEARCH_FLAG_WHOLE_WORD=2;
UI.SEARCH_FLAG_REGEXP=4;
UI.SEARCH_FLAG_FUZZY=8;
UI.SEARCH_FLAG_GOTO_MODE=1024;
var SetFindContextFinalResult=function(ctx,ccnt_center,matches){
	matches.sort(function(a,b){return a[0]-b[0];});
	var l=0
	var r=matches.length-1
	while(l<=r){
		var m=(l+r)>>1
		var ccnt_m=matches[m][0]
		if(ccnt_m<ccnt_center){
			l=m+1;
		}else{
			r=m-1;
		}
	}
	ctx.m_forward_search_hack=matches.slice(l)
	ctx.m_backward_search_hack=matches.slice(0,l)
	if(ctx.m_forward_search_hack.length==0&&ctx.m_backward_search_hack.length>0){
		ctx.m_init_point_hack=-1
	}
	//ctx.m_forward_frontier=-1
	//ctx.m_backward_frontier=-1
}

var g_is_parse_more_running=0
var CallParseMore=function(){
	if(g_is_parse_more_running){return;}
	var fcallmore=UI.HackCallback(function(){
		var ret=UI.ED_ParseMore()
		if(ret){
			var obj_tab=undefined;
			for(var i=0;i<UI.g_all_document_windows.length;i++){
				if(UI.g_all_document_windows[i].file_name==ret.file_name){
					obj_tab=UI.g_all_document_windows[i]
					break
				}
			}
			if(obj_tab&&obj_tab.main_widget&&obj_tab.main_widget.doc){
				obj_tab.main_widget.doc.m_file_index=ret.file_index
			}else{
				//not-opened-yet
				//if(UI.Platform.BUILD=="debug"){
				//	print("panic: failed to set m_file_index",ret.file_name)
				//}
			}
			UI.NextTick(fcallmore)
		}else{
			g_is_parse_more_running=0
		}
	});
	g_is_parse_more_running=1
	UI.NextTick(fcallmore)
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
		UI.Refresh()
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

W.CodeEditorWidget_prototype={
	m_current_wrap_width:1024,
	m_enable_wrapping:0,
	m_tabswitch_count:{},
	OnEditorCreate:function(){
		var doc=this.doc
		//doc.OnLoad=obj.OnLoad.bind(obj)
		doc.StartLoading(this.file_name)
		doc.AddEventHandler('selectionChange',function(){
			var obj=this.owner
			if(!obj){return;}
			var show_replace_hint=0
			if(obj.m_current_find_context&&!obj.m_replace_context&&!obj.m_no_more_replace){
				var ccnt=this.sel1.ccnt
				var match_id=obj.BisectMatches(ccnt)
				if(match_id){
					var match_ccnt0=obj.GetMatchCcnt(match_id,0)
					var match_ccnt1=obj.GetMatchCcnt(match_id,1)
					if(match_ccnt0<=ccnt&&ccnt<=match_ccnt1&&match_ccnt0<=this.sel0.ccnt&&this.sel0.ccnt<=match_ccnt1){
						show_replace_hint=1
					}
				}
			}
			if(show_replace_hint){
				obj.CreateNotification({
					id:'replace_hint',icon:'换',text:['Edit the match to start replacing'].join("\n")
				},"quiet")
			}else{
				obj.DismissNotification('replace_hint')
			}
		})
		doc.AddEventHandler('beforeEdit',function(ops){
			var obj=this.owner
			if(obj.m_current_find_context&&ops.length>0&&!obj.m_replace_context&&!obj.m_no_more_replace){
				var match_id=obj.BisectMatches(ops[0])
				if(match_id){
					var match_ccnt0=obj.GetMatchCcnt(match_id,0)
					var match_ccnt1=obj.GetMatchCcnt(match_id,1)
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
					}else{
						obj.m_no_more_replace=1;
					}
				}else{
					obj.m_no_more_replace=1;
				}
			}
		})
		doc.AddEventHandler('change',function(){
			var obj=this.owner
			if(obj.m_current_find_context){
				obj.m_current_find_context.Cancel()
				obj.m_current_find_context=undefined
			}
			if(obj.m_ac_context){
				//this should self-destruct when it's a disabling change
				//it should work properly if the user continues typing
				obj.m_ac_context.m_ccnt=-1;
			}
			obj.m_is_brand_new=0
			var renderer=this.ed.GetHandlerByID(this.ed.m_handler_registration["renderer"]);
			renderer.m_hidden_ranges_prepared=0
		})
		doc.AddEventHandler('ESC',function(){
			var obj=this.owner
			obj.m_notifications=[]
			obj.m_ac_context=undefined
			this.m_user_just_typed_char=0
			obj.DestroyReplacingContext();
			obj.hide_sxs_visualizer=!obj.hide_sxs_visualizer;
			if(!obj.m_sxs_visualizer){
				obj.hide_sxs_visualizer=0;
			}
			if(obj.m_current_find_context){
				obj.m_current_find_context.Cancel()
				obj.m_current_find_context=undefined
			}
			obj.m_hide_find_highlight=1
			UI.Refresh()
			return 1
		})
	},
	OnDestroy:function(){
		if(this.doc){
			//var sz=(this.doc.ed?this.doc.ed.GetTextSize():0)
			this.doc.m_is_destroyed=1;
			//break the connections for rc
			this.doc.ed=undefined;
			this.doc=undefined;
			//if(sz>CALL_GC_DOC_SIZE_THRESHOLD){
			//	//print("UI.NextTick(fcallGC);")
			//	UI.NextTick(fcallGC);
			//}
		}
	},
	///////////////////////////
	Reload:function(){
		this.SaveMetaData()
		if(this.m_current_find_context){
			this.m_current_find_context.Cancel()
			this.m_current_find_context=undefined
		}
		this.m_ac_context=undefined
		if(this.doc){
			this.doc.m_is_destroyed=1;
		}
		this.doc=undefined
		this.m_notifications=[]
		UI.Refresh()
	},
	///////////////////////////
	OnLoad:function(){
		var loaded_metadata=(UI.m_ui_metadata[this.file_name]||{})
		var doc=this.doc
		if(loaded_metadata.m_bookmarks){
			for(var i=0;i<10;i++){
				if(loaded_metadata.m_bookmarks[i]!='n/a'&&!doc.m_bookmarks[i]){
					doc.m_bookmarks[i]=doc.ed.CreateLocator(Math.max(Math.min(loaded_metadata.m_bookmarks[i],doc.ed.GetTextSize()),0))
				}
			}
		}
		if(loaded_metadata.m_unkeyed_bookmarks){
			var bm=loaded_metadata.m_unkeyed_bookmarks
			for(var i=0;i<bm.length;i++){
				doc.m_unkeyed_bookmarks.push(doc.ed.CreateLocator(Math.max(Math.min(bm[i],doc.ed.GetTextSize()),0)))
			}
		}
		if(loaded_metadata.sel0){doc.sel0.ccnt=Math.max(Math.min(loaded_metadata.sel0,doc.ed.GetTextSize()),0);}
		if(loaded_metadata.sel1){doc.sel1.ccnt=Math.max(Math.min(loaded_metadata.sel1,doc.ed.GetTextSize()),0);}
		for(var i=0;i<UI.m_code_editor_persistent_members.length;i++){
			var name_i=UI.m_code_editor_persistent_members[i]
			var value_i=loaded_metadata[name_i];
			if(value_i!=undefined){this[name_i]=value_i;}
		}
		for(var i=0;i<UI.m_code_editor_persistent_members_doc.length;i++){
			var name_i=UI.m_code_editor_persistent_members_doc[i]
			var value_i=loaded_metadata[name_i];
			if(value_i!=undefined){this.doc[name_i]=value_i;}
		}
		var renderer=doc.ed.GetHandlerByID(doc.ed.m_handler_registration["renderer"]);
		if(loaded_metadata.m_hidden_ranges){
			for(var i=0;i<loaded_metadata.m_hidden_ranges.length;i+=2){
				renderer.HideRange(doc.ed,loaded_metadata.m_hidden_ranges[i],loaded_metadata.m_hidden_ranges[i+1])
			}
		}
		doc.AutoScroll("center")
		doc.scrolling_animation=undefined
		doc.CallHooks("selectionChange")
		doc.CallHooks("load")
		this.ParseFile()
		this.m_finished_loading=1
		var cbs=this.opening_callbacks
		if(cbs){
			for(var i=0;i<cbs.length;i++){
				cbs[i].call(this.doc);
			}
			this.opening_callbacks=undefined
		}
		UI.Refresh()
	},
	SaveMetaData:function(){
		var doc=this.doc
		if(this.m_is_preview||doc&&doc.ed.hfile_loading){return;}
		if(!doc||!IO.FileExists(this.file_name)){return;}
		var new_metadata={m_bookmarks:[],m_unkeyed_bookmarks:[],
			sel0:doc.sel0.ccnt,
			sel1:doc.sel1.ccnt,
		}
		for(var i=0;i<UI.m_code_editor_persistent_members.length;i++){
			var name_i=UI.m_code_editor_persistent_members[i]
			new_metadata[name_i]=this[name_i]
		}
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
		var renderer=doc.ed.GetHandlerByID(doc.ed.m_handler_registration["renderer"]);
		new_metadata.m_hidden_ranges=renderer.GetHiddenRanges();
		UI.m_ui_metadata[this.file_name]=new_metadata
	},
	OnSave:function(){
		this.m_file_index=undefined;
		this.SaveMetaData();
		UI.SaveMetaData();
		this.doc.CallHooks("save")
		this.ParseFile()
	},
	Save:function(){
		var doc=this.doc
		if(doc.ed.hfile_loading){
			this.CreateNotification({id:'saving_progress',icon:'错',text:"You cannot save a file before it finishes loading"})
			return
		}
		var ctx=UI.EDSaver_Open(doc.ed,this.file_name)
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
	},
	////////////////////////////////////
	//the virtual document doesn't include middle expansion
	//middle-expand with fixed additional size to make it possible
	ResetFindingContext:function(sneedle,flags, force_ccnt){
		var doc=this.doc
		var ccnt=(force_ccnt==undefined?doc.sel1.ccnt:force_ccnt)
		//if(flags&UI.SEARCH_FLAG_GOTO_MODE){
		//	ccnt=0
		//}
		this.m_hide_find_highlight=0
		if(this.m_current_find_context){
			if(force_ccnt!=undefined&&
			force_ccnt==this.m_current_find_context.m_starting_ccnt0&&
			!this.m_changed_after_find&&
			sneedle==this.m_current_find_context.m_needle&&
			!(this.m_current_find_context.m_flags&UI.SEARCH_FLAG_FUZZY)){
				return;
			}
			this.m_current_find_context.Cancel()
			this.m_current_find_context=undefined
		}
		if(!sneedle.length&&!(flags&UI.SEARCH_FLAG_GOTO_MODE)){
			if(this.m_current_find_context){
				this.m_current_find_context.Cancel()
			}
			this.m_current_find_context=undefined
			//this.m_current_needle=undefined
			UI.m_ui_metadata.find_state.m_current_needle=""
			return;
		}
		if(!(flags&UI.SEARCH_FLAG_GOTO_MODE)){
			UI.m_ui_metadata.find_state.m_current_needle=sneedle
		}
		var hc=UI.GetCharacterHeight(doc.font)
		var ccnt_tot=doc.ed.GetTextSize()
		var ytot=doc.ed.XYFromCcnt(ccnt_tot).y+doc.ed.GetCharacterHeightAt(ccnt_tot);
		var ctx={
			m_original_frontier:ccnt,
			m_is_just_reset:1,
			m_forward_matches:[],
			m_forward_frontier:ccnt,
			m_backward_matches:[],
			m_backward_frontier:ccnt,
			m_highlight_ranges:[],
			m_locators:[],
			m_owner:this,
			m_starting_ccnt0:force_ccnt==undefined?doc.sel0.ccnt:ccnt,
			m_starting_ccnt1:force_ccnt==undefined?doc.sel1.ccnt:ccnt,
			m_current_point:0,
			m_needle:sneedle,
			m_flags:flags,
			m_find_scroll_visual_y:-(this.h/this.find_item_scale-this.find_item_expand_current*hc)*0.5,
			m_home_end:'init',
			///////////////////////////////
			m_merged_y_windows_backward:[],
			m_merged_y_windows_forward:[],
			m_mergable_ccnt_backward:undefined,
			m_mergable_ccnt_forward:undefined,
			m_current_merged_item:0,
			m_y_extent_backward:0,
			m_y_extent_forward:0,
			CreateHighlight:function(ccnt0,ccnt1){
				var doc=this.m_owner.doc
				var locator_0=doc.ed.CreateLocator(ccnt0,-1);locator_0.undo_tracked=0;
				var locator_1=doc.ed.CreateLocator(ccnt1,-1);locator_1.undo_tracked=0;
				var hlobj=doc.ed.CreateHighlight(locator_0,locator_1,-1)
				hlobj.color=this.m_owner.find_item_highlight_color;
				hlobj.invertible=0;
				this.m_highlight_ranges.push(hlobj);
				this.m_locators.push(locator_0);
				this.m_locators.push(locator_1);
				UI.Refresh()
			},
			ReportMatchForward:function(ccnt0,ccnt1){
				this.m_forward_matches.push(ccnt0,ccnt1)
				this.CreateHighlight(ccnt0,ccnt1)
				return 1024
			},
			ReportMatchBackward:function(ccnt0,ccnt1){
				this.m_backward_matches.push(ccnt0,ccnt1)
				this.CreateHighlight(ccnt0,ccnt1)
				return 1024
			},
			Cancel:function(){
				for(var i=0;i<this.m_highlight_ranges.length;i++){
					this.m_highlight_ranges[i].discard()
				}
				for(var i=0;i<this.m_locators.length;i++){
					this.m_locators[i].discard()
				}
			},
		}
		this.m_current_find_context=ctx
		var y_id=doc.ed.XYFromCcnt(ccnt).y
		var y_id0=Math.max(y_id-hc,0),y_id1=Math.min(y_id+hc*2,ytot)
		//id, virtual_screen_y, scroll_y, h
		//the middle segment is duplicated for convenience
		ctx.m_merged_y_windows_backward.push(0,-hc,y_id0,y_id1-y_id0)
		ctx.m_merged_y_windows_forward.push(0,-hc,y_id0,y_id1-y_id0)
		ctx.m_mergable_ccnt_backward=doc.ed.SeekXY(0,y_id)
		ctx.m_mergable_ccnt_forward=doc.ed.SeekXY(1e17,y_id)
		ctx.m_y_extent_backward=-hc
		ctx.m_y_extent_forward=hc*2
		if(force_ccnt==undefined){
			this.AutoScrollFindItems();
			UI.InvalidateCurrentFrame();
			UI.Refresh()
		}
		if(flags&UI.SEARCH_FLAG_GOTO_MODE){
			//ignore the flags
			var matches=[]
			//try to go to line number first
			var line_id=parseInt(sneedle)
			if(line_id>0){
				var line_ccnts=doc.SeekAllLinesBetween(line_id-1,line_id+1)
				if(line_ccnts[0]<line_ccnts[1]){
					var line_ccnt0=doc.ed.MoveToBoundary(line_ccnts[0],1,"space");
					var line_ccnt1=line_ccnts[1]-1
					if(!(line_ccnt1>line_ccnt0)){line_ccnt1=line_ccnt0;}
					matches.push([line_ccnt0,line_ccnt1])
				}
			}else{
				//search for function / class
				var sneedle_lower=sneedle.toLowerCase()
				var lg_needle=Duktape.__byte_length(sneedle_lower)
				var all_key_decls=UI.ED_GetAllKeyDecls(doc)
				if(all_key_decls){
					for(var i=0;i<all_key_decls.length;i+=3){
						var s_id=all_key_decls[i+0]
						var s_id_lower=s_id.toLowerCase()
						if(s_id_lower.length>=sneedle_lower.length){
							if(s_id_lower.substr(0,sneedle_lower.length)==sneedle_lower){
								//we don't need the type here
								//var type=all_key_decls[i+1]
								var ccnt_match=all_key_decls[i+2]
								if(sneedle_lower.length&&doc.ed.GetText(ccnt_match,lg_needle).toLowerCase()==sneedle_lower){
									matches.push([ccnt_match,ccnt_match+lg_needle])
								}else{
									var ccnt_match1=doc.SnapToValidLocation(doc.ed.MoveToBoundary(doc.ed.SnapToCharBoundary(ccnt_match,1),1,"word_boundary_right"),1)
									matches.push([ccnt_match,ccnt_match1])
								}
							}
						}
					}
				}
			}
			SetFindContextFinalResult(ctx,ccnt,matches)
			UI.Refresh()
		}
	},
	GetFindItem:function(id){
		var ctx=this.m_current_find_context
		var arr,ofs;
		if(id<0){
			ofs=-id
			arr=ctx.m_merged_y_windows_backward
		}else{
			ofs=id
			arr=ctx.m_merged_y_windows_forward
		}
		ofs<<=2
		return {id:arr[ofs+0],visual_y:arr[ofs+1],scroll_y:arr[ofs+2],shared_h:arr[ofs+3]}
	},
	BisectFindItems:function(y){
		var ctx=this.m_current_find_context
		var l0=-((ctx.m_merged_y_windows_backward.length>>2)-1);
		var l=l0;
		var r=(ctx.m_merged_y_windows_forward.length>>2)-1
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
	GetMatchCcnt:function(id,side){
		var ctx=this.m_current_find_context
		if(id==0){
			return side==0?ctx.m_starting_ccnt0:ctx.m_starting_ccnt1;
		}else if(id<0){
			var ofs=(id+1)*(-2)+side
			if(ofs<ctx.m_backward_matches.length){
				return ctx.m_backward_matches[ofs]
			}
		}else{
			var ofs=(id-1)*2+side
			if(ofs<ctx.m_forward_matches.length){
				return ctx.m_forward_matches[ofs]
			}
		}
		return undefined
	},
	AutoScrollFindItems:function(){
		this.m_no_more_replace=0
		var doc=this.doc
		var ctx=this.m_current_find_context
		var l0=-((ctx.m_merged_y_windows_backward.length>>2)-1)
		var l=l0
		var r=(ctx.m_merged_y_windows_forward.length>>2)-1
		var id=ctx.m_current_point
		if(ctx.m_flags&UI.SEARCH_FLAG_FUZZY){
			if(!ctx.m_fuzzy_virtual_diffs||ctx.m_fuzzy_diff_match_id!=id){
				//fuzzy match rendering - GetMatchCcnt, something else like m_tentative_editops but rendered the other direction
				var renderer=doc.ed.GetHandlerByID(doc.ed.m_handler_registration["renderer"]);
				ctx.m_fuzzy_virtual_diffs=UI.ED_RawEditDistance(doc.ed,
					this.GetMatchCcnt(id,0),this.GetMatchCcnt(id,1),
					ctx.m_needle, ctx.m_flags&UI.SEARCH_FLAG_CASE_SENSITIVE);
				ctx.m_fuzzy_diff_match_id=id;
			}
		}
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
		var fitem_current=this.GetFindItem(r)
		ctx.m_current_merged_item=r
		ctx.m_current_visual_y=doc.ed.XYFromCcnt(this.GetMatchCcnt(id,0)).y-fitem_current.scroll_y+fitem_current.visual_y
		////////////////////
		var hc=UI.GetCharacterHeight(doc.font)
		var find_shared_h=(this.h-this.h_find_bar)/this.find_item_scale-this.find_item_expand_current*hc
		var h_bof_eof_message_with_sep=UI.GetCharacterHeight(this.find_message_font)+this.find_item_separation*2
		ctx.m_current_visual_h=find_shared_h
		var ccnt_match0=this.GetMatchCcnt(id,0)
		var ccnt_match1=((ctx.m_flags&UI.SEARCH_FLAG_GOTO_MODE)?ccnt_match0:this.GetMatchCcnt(id,1))
		UI.RecordCursorHistroy(doc,(ctx.m_flags&UI.SEARCH_FLAG_GOTO_MODE)?"goto":"find")
		doc.sel0.ccnt=ccnt_match0
		doc.sel1.ccnt=ccnt_match1
		UI.g_cursor_history_test_same_reason=1
		doc.AutoScroll("show")
		ctx.m_find_scroll_visual_y=Math.min(Math.max(ctx.m_find_scroll_visual_y,ctx.m_current_visual_y+fitem_current.shared_h+h_bof_eof_message_with_sep-find_shared_h),ctx.m_current_visual_y-h_bof_eof_message_with_sep)
		ctx.m_find_scroll_visual_y=Math.max(Math.min(ctx.m_find_scroll_visual_y,ctx.m_y_extent_forward+h_bof_eof_message_with_sep-find_shared_h),ctx.m_y_extent_backward-h_bof_eof_message_with_sep)
	},
	BisectMatches:function(ccnt){
		var ctx=this.m_current_find_context
		var l0=-(ctx.m_backward_matches.length>>1)
		var l=l0
		var r=(ctx.m_forward_matches.length>>1)
		while(l<=r){
			var m=(l+r)>>1
			var ccnt_m=this.GetMatchCcnt(m,0)
			if(ccnt_m<=ccnt){
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
		var ctx=this.m_current_find_context
		var doc=this.doc
		//visual y -> bsearch -> scroll_y
		var l0=-((ctx.m_merged_y_windows_backward.length>>2)-1);
		var l=l0;
		var r=(ctx.m_merged_y_windows_forward.length>>2)-1
		var id=ctx.m_current_point
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
		var ccnt=doc.ed.SeekXY(scroll_x,scroll_y)
		//ccnt -> bsearch -> match id
		ctx.m_current_point=this.BisectMatches(ccnt)
	},
	RenderVisibleFindItems:function(w_line_numbers,w_find_items,h_find_items, DrawItem){
		this.AutoScrollFindItems()
		var ctx=this.m_current_find_context
		var doc=this.doc
		if(ctx.m_fuzzy_virtual_diffs){
			var renderer=doc.ed.GetHandlerByID(doc.ed.m_handler_registration["renderer"]);
			renderer.m_virtual_diffs=ctx.m_fuzzy_virtual_diffs;
		}
		//do it here and now
		var hc=UI.GetCharacterHeight(doc.font)
		var h_bof_eof_message=UI.GetCharacterHeight(this.find_message_font)+this.find_item_separation
		var eps=hc/16;
		var ccnt_middle=this.GetMatchCcnt(ctx.m_current_point,1)
		var xy_middle=doc.ed.XYFromCcnt(ccnt_middle)
		var find_scroll_x=Math.max(xy_middle.x-(w_find_items-w_line_numbers),0)
		var find_scroll_y=ctx.m_find_scroll_visual_y
		var anim_node=W.AnimationNode("find_item_scrolling",{
			scroll_x:find_scroll_x,
			scroll_y:find_scroll_y,
		})
		find_scroll_x=anim_node.scroll_x
		find_scroll_y=anim_node.scroll_y
		if(ctx.m_is_just_reset){
			//don't animate the first round
			ctx.m_is_just_reset=0;
			this.find_item_scrolling=undefined;
		}
		var find_shared_h=h_find_items
		var ccnt_tot=doc.ed.GetTextSize()
		var ytot=doc.ed.XYFromCcnt(ccnt_tot).y+doc.ed.GetCharacterHeightAt(ccnt_tot);
		var h_safety=hc*this.find_item_expand_current;
		var h_safety_internal=h_safety+h_find_items//for page up/down
		//auto-fuzzy search
		if(find_scroll_y<ctx.m_y_extent_backward+h_safety_internal&&!UI.IsSearchFrontierCompleted(ctx.m_backward_frontier)){
			var p0=ctx.m_backward_matches.length
			if(ctx.m_backward_search_hack){
				var matches=ctx.m_backward_search_hack
				ctx.m_backward_search_hack=undefined
				for(var i=matches.length-1;i>=0;i--){
					ctx.ReportMatchBackward(matches[i][0],matches[i][1])
				}
				ctx.m_backward_frontier=-1
			}else{
				ctx.m_backward_frontier=UI.ED_Search(doc.ed,ctx.m_backward_frontier,-1,ctx.m_needle,ctx.m_flags,262144,ctx.ReportMatchBackward,ctx)
			}
			var ccnt_merged_anyway=ctx.m_mergable_ccnt_backward
			var current_y1=ctx.m_merged_y_windows_backward.pop()
			var current_y0=ctx.m_merged_y_windows_backward.pop()
			var current_visual_y=ctx.m_merged_y_windows_backward.pop()
			var current_id=ctx.m_merged_y_windows_backward.pop()
			current_y1+=current_y0
			for(var pmatch=p0;pmatch<ctx.m_backward_matches.length;pmatch+=2){
				var ccnt_id=ctx.m_backward_matches[pmatch]
				if(ccnt_id>=ccnt_merged_anyway){current_id=-1-(pmatch>>1);continue;}
				var y_id=doc.ed.XYFromCcnt(ccnt_id).y
				var y_id0=Math.max(y_id-hc,0),y_id1=Math.min(y_id+hc*2,ytot)
				if(y_id1>current_y0-eps){
					//merge
					current_visual_y-=Math.max(current_y0-y_id0,0)
					current_id=-1-(pmatch>>1)
					current_y0=y_id0
				}else{
					ctx.m_merged_y_windows_backward.push(current_id,current_visual_y,current_y0,current_y1-current_y0)
					current_id=-1-(pmatch>>1)
					current_y0=y_id0
					current_y1=y_id1
					current_visual_y-=y_id1-y_id0+this.find_item_separation
				}
				ccnt_merged_anyway=doc.ed.SeekXY(0,y_id)
			}
			ctx.m_merged_y_windows_backward.push(current_id,current_visual_y,current_y0,current_y1-current_y0)
			ctx.m_mergable_ccnt_backward=ccnt_merged_anyway
			ctx.m_merged_y_windows_forward[0]=ctx.m_merged_y_windows_backward[0]
			ctx.m_merged_y_windows_forward[1]=ctx.m_merged_y_windows_backward[1]
			ctx.m_merged_y_windows_forward[2]=ctx.m_merged_y_windows_backward[2]
			ctx.m_merged_y_windows_forward[3]=ctx.m_merged_y_windows_backward[3]
			ctx.m_y_extent_backward=current_visual_y
			if(ctx.m_home_end=='home'){
				ctx.m_current_point=-(ctx.m_backward_matches.length>>1)
				if(UI.IsSearchFrontierCompleted(ctx.m_backward_frontier)){
					ctx.m_home_end=undefined
				}
			}
			if(ctx.m_home_end=='init'){
				if(ctx.m_init_point_hack!=undefined){
					ctx.m_current_point=ctx.m_init_point_hack
					ctx.m_home_end=undefined
				}
			}
			UI.Refresh()
		}
		if(find_scroll_y+find_shared_h>ctx.m_y_extent_forward-h_safety_internal&&!UI.IsSearchFrontierCompleted(ctx.m_forward_frontier)){
			var p0=ctx.m_forward_matches.length
			if(ctx.m_forward_search_hack){
				var matches=ctx.m_forward_search_hack
				ctx.m_forward_search_hack=undefined
				for(var i=0;i<matches.length;i++){
					ctx.ReportMatchForward(matches[i][0],matches[i][1])
				}
				ctx.m_forward_frontier=-1
			}else{
				ctx.m_forward_frontier=UI.ED_Search(doc.ed,ctx.m_forward_frontier,1,ctx.m_needle,ctx.m_flags,262144,ctx.ReportMatchForward,ctx);
			}
			var ccnt_merged_anyway=ctx.m_mergable_ccnt_forward
			var current_y1=ctx.m_merged_y_windows_forward.pop()
			var current_y0=ctx.m_merged_y_windows_forward.pop()
			var current_visual_y=ctx.m_merged_y_windows_forward.pop()
			var current_id=ctx.m_merged_y_windows_forward.pop()
			current_y1+=current_y0
			for(var pmatch=p0;pmatch<ctx.m_forward_matches.length;pmatch+=2){
				var ccnt_id=ctx.m_forward_matches[pmatch]
				if(ccnt_id<=ccnt_merged_anyway){continue;}
				var y_id=doc.ed.XYFromCcnt(ccnt_id).y
				var y_id0=Math.max(y_id-hc,0),y_id1=Math.min(y_id+hc*2,ytot)
				if(y_id0<current_y1+eps){
					//merge
					current_y1=y_id1
				}else{
					ctx.m_merged_y_windows_forward.push(current_id,current_visual_y,current_y0,current_y1-current_y0)
					current_visual_y+=current_y1-current_y0+this.find_item_separation
					current_id=(pmatch>>1)+1
					current_y0=y_id0
					current_y1=y_id1
				}
				ccnt_merged_anyway=doc.ed.SeekXY(1e17,y_id)
			}
			ctx.m_merged_y_windows_forward.push(current_id,current_visual_y,current_y0,current_y1-current_y0)
			ctx.m_mergable_ccnt_forward=ccnt_merged_anyway
			ctx.m_merged_y_windows_backward[0]=ctx.m_merged_y_windows_forward[0]
			ctx.m_merged_y_windows_backward[1]=ctx.m_merged_y_windows_forward[1]
			ctx.m_merged_y_windows_backward[2]=ctx.m_merged_y_windows_forward[2]
			ctx.m_merged_y_windows_backward[3]=ctx.m_merged_y_windows_forward[3]
			ctx.m_y_extent_forward=current_visual_y+current_y1-current_y0
			if(ctx.m_home_end=='end'){
				ctx.m_current_point=(ctx.m_forward_matches.length>>1)
				if(UI.IsSearchFrontierCompleted(ctx.m_forward_frontier)){
					ctx.m_home_end=undefined
				}
			}
			if(ctx.m_home_end=='init'){
				if(ctx.m_forward_matches.length>0){
					ctx.m_current_point=1
					ctx.m_home_end=undefined
				}else if(UI.IsSearchFrontierCompleted(ctx.m_forward_frontier)){
					ctx.m_home_end=undefined
				}
			}
			UI.Refresh()
		}
		var p0=this.BisectFindItems(find_scroll_y-h_safety)
		var p1=this.BisectFindItems(find_scroll_y+find_shared_h+h_safety)
		var ret=[]
		if(p0==-((ctx.m_merged_y_windows_backward.length>>2)-1)){
			//BOF
			var s_bof_message;
			if(!UI.IsSearchFrontierCompleted(ctx.m_backward_frontier)){
				s_bof_message=UI._("Searching @1%").replace("@1",((1-UI.GetSearchFrontierCcnt(ctx.m_backward_frontier)/ccnt_tot)*100).toFixed(0))
			}else{
				s_bof_message=UI._("No more '@1' above".replace("@1",ctx.m_needle))
			}
			var text_dim=UI.MeasureText(this.find_message_font,s_bof_message)
			var y=ctx.m_y_extent_backward-find_scroll_y-h_bof_eof_message
			W.Text("",{
				x:(w_find_items-text_dim.w)*0.5,y:y,
				font:this.find_message_font,color:this.find_message_color,
				text:s_bof_message})
		}
		for(var i=p0;i<=p1;i++){
			var find_item_i=this.GetFindItem(i)
			var h_expand=0
			if(i==ctx.m_current_merged_item){
				h_expand=hc*this.find_item_expand_current;
			}
			var nodekey="find_item_"+i.toString();
			h_expand=W.AnimationNode(nodekey,{
				h_expand:h_expand,
			}).h_expand
			find_scroll_y-=h_expand*0.5
			DrawItem(find_item_i, find_scroll_x,find_scroll_y,h_expand)
			find_scroll_y-=h_expand*0.5
		}
		if(p1==(ctx.m_merged_y_windows_forward.length>>2)-1){
			//EOF
			var s_eof_message;
			if(!UI.IsSearchFrontierCompleted(ctx.m_forward_frontier)){
				s_eof_message=UI._("Searching @1%").replace("@1",((UI.GetSearchFrontierCcnt(ctx.m_forward_frontier)/ccnt_tot)*100).toFixed(0))
			}else{
				s_eof_message=UI._("No more '@1' below").replace("@1",ctx.m_needle)
			}
			var text_dim=UI.MeasureText(this.find_message_font,s_eof_message)
			var y=ctx.m_y_extent_forward-find_scroll_y+this.find_item_separation
			W.Text("",{
				x:(w_find_items-text_dim.w)*0.5,y:y,
				font:this.find_message_font,color:this.find_message_color,
				text:s_eof_message})
		}
		return ret
	},
	FindNext:function(direction){
		UI.assert(!this.m_find_next_context,"panic: FindNext when there is another context")
		if(!UI.m_ui_metadata.find_state.m_current_needle){
			//no needle, no find
			return;
		}
		this.m_hide_find_highlight=0
		this.m_no_more_replace=0
		this.DestroyReplacingContext()
		var doc=this.doc
		var ccnt=doc.sel1.ccnt
		var ctx={
			m_frontier:ccnt,
			m_owner:this,
			m_needle:UI.m_ui_metadata.find_state.m_current_needle,
			m_flags:UI.m_ui_metadata.find_state.m_find_flags,
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
				this.m_frontier=UI.ED_Search(doc.ed,this.m_frontier,direction,this.m_needle,this.m_flags,1048576,this.ReportMatch,this)
				if(UI.IsSearchFrontierCompleted(this.m_frontier)||this.m_match_reported){
					UI.assert(this.m_owner.m_find_next_context==this,"panic: FindNext context overwritten")
					this.m_owner.ReleaseEditLock();
					this.m_owner.m_find_next_context=undefined
					if(!this.m_match_reported){
						//notification
						this.m_owner.CreateNotification({id:'find_result',icon:'警',text:(direction<0?"No more '@1' above":"No more '@1' below").replace("@1",this.m_needle)})
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
	BeforeQuickFind:function(direction){
		var sel=this.doc.GetSelection()
		//this.show_find_bar=1
		this.m_sel0_before_find=this.doc.sel0.ccnt
		this.m_sel1_before_find=this.doc.sel1.ccnt
		if(!(sel[0]<sel[1])){
			var ccnt=this.doc.sel1.ccnt
			var ed=this.doc.ed
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
		if(sel[0]<sel[1]){
			if(this.m_current_find_context){
				this.m_current_find_context.Cancel()
				this.m_current_find_context=undefined
			}
			UI.m_ui_metadata.find_state.m_current_needle=this.doc.ed.GetText(sel[0],sel[1]-sel[0])
			if(UI.m_ui_metadata.find_state.m_find_flags&UI.SEARCH_FLAG_REGEXP){
				UI.m_ui_metadata.find_state.m_current_needle=RegexpEscape(UI.m_ui_metadata.find_state.m_current_needle)
			}
		}
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
		hlobj.color=this.find_item_highlight_color;
		hlobj.invertible=0;
		rctx.m_highlight=hlobj
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
					need_onchange=1
					if(n_replaced){
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
		var sel=doc.GetSelection()
		var ccnt0,ccnt1;
		if(sel[0]<sel[1]&&!is_first){
			ccnt0=sel[0]
			ccnt1=sel[1]
		}else{
			if(is_first<0){
				ccnt0=0
				ccnt1=sel[0]
			}else{
				ccnt0=sel[1]
				ccnt1=doc.ed.GetTextSize()
			}
		}
		var srep_ccnt0=rctx.m_locators[0].ccnt
		var srep_ccnt1=rctx.m_locators[1].ccnt
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
				this.notification_list[item.id].dx_shake=this.dx_shake_notification
				//}
				return
			}
		}
	},
	CreateNotification:function(attrs,is_quiet){
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
		ns.push(attrs)
		UI.Refresh()
		return attrs;
	},
	DismissNotification:function(id){
		if(this.m_notifications){
			this.m_notifications=this.m_notifications.filter(function(a){return a.id!=id})
		}
	},
	DismissNotificationsByRegexp:function(re){
		if(this.m_notifications){
			this.m_notifications=this.m_notifications.filter(function(a){return !(a.id.search(re)>=0)})
		}
	},
	////////////////////////////////
	ParseFile:function(){
		if(this.m_is_preview){return;}
		UI.BumpHistory(this.file_name)
		var doc=this.doc
		var sz=doc.ed.GetTextSize()
		if(sz>MAX_PARSABLE||!this.show_auto_completion){
			return;
		}
		//doc.m_file_index=UI.ED_ParseAs(this.file_name,doc.plugin_language_desc)
		UI.ED_ParserQueueFile(this.file_name)
		doc.CallHooks("parse")
		CallParseMore()
	},
}

var ffindbar_plugin=function(){
	this.AddEventHandler('ESC',function(){
		this.CancelFind();
	})
	this.AddEventHandler('RETURN',function(){
		var obj=this.owner
		obj.show_find_bar=0;
		obj.doc.AutoScroll('center')
		obj.doc.scrolling_animation=undefined
		UI.Refresh()
	})
	this.AddEventHandler('change',function(){
		var obj=this.owner
		obj.doc.sel0.ccnt=obj.m_sel0_before_find
		obj.doc.sel1.ccnt=obj.m_sel1_before_find
		obj.DestroyReplacingContext();
		var find_flag_mode=(obj.show_find_bar=="goto"?UI.SEARCH_FLAG_GOTO_MODE:0)
		obj.ResetFindingContext(this.ed.GetText(),UI.m_ui_metadata.find_state.m_find_flags|find_flag_mode)
	})
	this.AddEventHandler('UP',function(){
		var obj=this.owner
		if(obj.m_current_find_context){
			var ctx=obj.m_current_find_context
			ctx.m_home_end=undefined;
			if(ctx.m_current_point>-((ctx.m_backward_matches.length>>1))){
				ctx.m_current_point--
				obj.AutoScrollFindItems()
				UI.Refresh()
			}
		}
	})
	this.AddEventHandler('DOWN',function(){
		var obj=this.owner
		if(obj.m_current_find_context){
			var ctx=obj.m_current_find_context
			ctx.m_home_end=undefined;
			if(ctx.m_current_point<(ctx.m_forward_matches.length>>1)){
				ctx.m_current_point++
				obj.AutoScrollFindItems()
				UI.Refresh()
			}
		}
	})
	//////////////////////////////////////////////////
	this.AddEventHandler('PGUP',function(){
		var obj=this.owner
		if(obj.m_current_find_context){
			var ctx=obj.m_current_find_context
			ctx.m_find_scroll_visual_y-=ctx.m_current_visual_h
			obj.SeekFindItemByVisualY(ctx.m_current_visual_y-ctx.m_current_visual_h,1e17)
			ctx.m_home_end=undefined;
			obj.AutoScrollFindItems()
			UI.Refresh()
		}
	})
	this.AddEventHandler('PGDN',function(){
		var obj=this.owner
		if(obj.m_current_find_context){
			var ctx=obj.m_current_find_context
			ctx.m_find_scroll_visual_y+=ctx.m_current_visual_h
			obj.SeekFindItemByVisualY(ctx.m_current_visual_y+ctx.m_current_visual_h,0)
			ctx.m_home_end=undefined;
			obj.AutoScrollFindItems()
			UI.Refresh()
		}
	})
	this.AddEventHandler('CTRL+HOME',function(){
		var obj=this.owner
		if(obj.m_current_find_context){
			var ctx=obj.m_current_find_context
			obj.SeekFindItemByVisualY(ctx.m_y_extent_backward,0)
			ctx.m_home_end='home';
			obj.AutoScrollFindItems()
			UI.Refresh()
		}
	})
	this.AddEventHandler('CTRL+END',function(){
		var obj=this.owner
		if(obj.m_current_find_context){
			var ctx=obj.m_current_find_context
			obj.SeekFindItemByVisualY(ctx.m_y_extent_forward,1e17)
			ctx.m_home_end='end';
			obj.AutoScrollFindItems()
			UI.Refresh()
		}
	})
}

var g_repo_from_file={}
var g_repo_list={}
var ParseGit=function(spath){
	var my_repo={name:spath,is_parsing:1,files:[]}
	g_repo_list[spath]=my_repo
	IO.RunTool(["git","ls-files"],spath, ".*",function(match){
		if(match[0].indexOf(':')>=0){
			return;
		}
		var fname=spath+"/"+match[0]
		if(UI.Platform.ARCH=="win32"||UI.Platform.ARCH=="win64"){
			fname=fname.toLowerCase()
		}
		var repos=g_repo_from_file[fname]
		if(!repos){
			repos={};
			g_repo_from_file[fname]=repos
		}
		//repo -> status map
		repos[spath]=0
		my_repo.files.push(fname)
	},function(){
		//some dangling dependencies may have been resolved
		if(UI.ED_ReparseDanglingDeps()){
			CallParseMore()
		}
		IO.RunTool(["git","ls-files","--modified"],spath, ".*",function(match){
			if(match[0].indexOf(':')>=0){
				return;
			}
			var fname=spath+"/"+match[0]
			if(UI.Platform.ARCH=="win32"||UI.Platform.ARCH=="win64"){
				fname=fname.toLowerCase()
			}
			var repos=g_repo_from_file[fname]
			if(!repos){
				repos={};
				g_repo_from_file[fname]=repos
			}
			//repo -> status map
			repos[spath]=1
		},function(){
			my_repo.is_parsing=0
			UI.Refresh()
		}, 30)
	}, 30)
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
	if(spath!='.'&&IO.DirExists(spath+"/.git")){
		ParseGit(spath)
		g_is_repo_detected[spath]=spath;
		return spath
	}
	///////////////////
	g_is_repo_detected[spath]="?";
	var ret=DetectRepository(spath);
	g_is_repo_detected[spath]=ret;
	return ret;
}

var FILE_LISTING_BUDGET=100
W.FileItemOnDemand=function(){
	if(this.git_repo_to_list){
		var repo=g_repo_list[this.git_repo_to_list]
		if(repo.is_parsing){
			return "keep";
		}
		var hist_keywords=this.search_text.split(" ").filter(function(a){return a.toLowerCase()});
		var ret=[]
		for(var i=0;i<repo.files.length;i++){
			var fname_i=repo.files[i]
			if(UI.m_current_file_list.m_appeared_full_names[fname_i]){continue;}
			var fn_i_search=fname_i.toLowerCase()
			var is_invalid=0;
			var hl_ranges=[]
			for(var j=0;j<hist_keywords.length;j++){
				var pj=fn_i_search.lastIndexOf(hist_keywords[j]);
				if(pj<0){
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
		return "keep"
	}
	if(!this.m_find_context){
		//enum both files and dirs
		this.m_find_context=IO.CreateEnumFileContext(this.name_to_find,3)
	}
	var ret=[];
	for(var i=0;i<FILE_LISTING_BUDGET;i++){
		var fnext=this.m_find_context()
		if(!fnext){
			this.m_find_context=undefined;
			if(!ret.length&&this.create_if_not_found){
				ret.push({
					name_to_create:this.create_if_not_found,
					name:this.create_if_not_found,
					h:UI.default_styles.file_item.h})
			}
			return ret
		}
		if(UI.Platform.ARCH=="win32"||UI.Platform.ARCH=="win64"){
			fnext.name=fnext.name.toLowerCase()
		}
		if(UI.m_current_file_list.m_appeared_full_names[fnext.name]){continue;}
		UI.m_current_file_list.m_appeared_full_names[fnext.name]=1
		DetectRepository(fnext.name)
		//avoid duplicate
		ret.push({
			name:fnext.name,
			size:fnext.size,
			is_dir:fnext.is_dir,
			time:fnext.time,
			history_hl_ranges:this.history_hl_ranges,
			h:UI.default_styles.file_item.h})
	}
	ret.push(this)
	return ret;
}

var GetSmartFileName=function(obj_param){
	if(!obj_param.display_name){
		var redo_queue=[]
		redo_queue.push(obj_param)
		for(;redo_queue.length;){
			var obj=redo_queue.pop()
			var ret=obj.display_name
			if(ret){return ret;}
			var arv=UI.m_current_file_list.m_appeared_names
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
					UI.InvalidateCurrentFrame()
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
		return (size/1099511627776).toFixed(1)+"TB"
	}
}

var FormatRelativeTime=function(then,now){
	if(now[0]==then[0]){
		if(now[1]==then[1]){
			if(now[2]==then[2]){
				return UI.Format("@1:@2",ZeroPad(then[3],2),ZeroPad(then[4],2,10))
			}else if(now[2]==then[2]+1){
				return UI.Format("@1:@2 Yesterday",ZeroPad(then[3],2),ZeroPad(then[4],2,10))
			}
		}
		return UI.MonthDay(then[1],then[2])
	}else{
		return UI.Format("@1/@2/@3",ZeroPad(then[1]+1,2),ZeroPad(then[2]+1,2),then[0])
	}
}

var OpenInPlace=function(obj,name){
	var fn=IO.NormalizeFileName(name)
	var my_tabid=undefined
	for(var i=0;i<UI.g_all_document_windows.length;i++){
		if(UI.g_all_document_windows[i].main_widget===obj){
			my_tabid=i
			break
		}
	}
	//alt+q searched switch should count BIG toward the switching history
	if(UI.m_previous_document){
		var counts=UI.m_ui_metadata[UI.m_previous_document]
		if(counts){counts=counts.m_tabswitch_count;}
		for(var i=0;i<UI.g_all_document_windows.length;i++){
			if(i==my_tabid){continue;}
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
	for(var i=0;i<UI.g_all_document_windows.length;i++){
		if(i!=my_tabid&&UI.g_all_document_windows[i].file_name==fn){
			UI.top.app.document_area.SetTab(i)
			UI.top.app.document_area.CloseTab(my_tabid)
			return
		}
	}
	obj.file_name=fn
	obj.doc=undefined
	obj.m_language_id=undefined
	obj.m_is_brand_new=undefined;
	obj.m_is_preview=undefined;
	UI.top.app.quit_on_zero_tab=0;
	UI.m_current_file_list=undefined
	UI.Refresh()
}

var FileItem_prototype={
	OnDblClick:function(event){
		if(this.name_to_find){return;}
		if(this.is_dir){
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
		var obj=this.owner.owner
		OpenInPlace(obj,this.name)
	},
}
W.FileItem=function(id,attrs){
	var obj=UI.StdWidget(id,attrs,"file_item",FileItem_prototype);
	var parent_list_view=UI.context_parent;
	UI.Begin(obj)
		//icon, name, meta-info
		//hopefully go without a separator line
		if(obj.y<parent_list_view.y+parent_list_view.h&&obj.y+obj.h>parent_list_view.y){
			if(obj.git_repo_to_list){
				//display a searching... text
				W.Text("",{x:obj.x+4,y:obj.y+4,
					font:obj.name_font,text:UI._("Parsing git repo @1...").replace("@1",obj.git_repo_to_list),
					color:obj.misc_color})
			}else if(obj.name_to_find){
				//display a searching... text
				W.Text("",{x:obj.x+4,y:obj.y+4,
					font:obj.name_font,text:UI._("Searching @1...").replace("@1",obj.name_to_find),
					color:obj.misc_color})
			}else{
				var s_ext=UI.GetFileNameExtension(obj.name)
				var language_id=Language.GetNameByExt(s_ext)
				var desc=Language.GetDescObjectByName(language_id)
				var ext_color=(desc.file_icon_color||obj.file_icon_color)
				var icon_code=(desc.file_icon||'档').charCodeAt(0)
				if(obj.is_dir){
					ext_color=0xffb4771f
					icon_code='开'.charCodeAt(0)
				}
				if(obj.name_to_create){
					ext_color=0xff000000
					icon_code='新'.charCodeAt(0)
				}
				var sel_bgcolor=ext_color
				//////////////
				var icon_font=UI.Font(UI.icon_font_name,obj.h_icon)
				var w_icon=UI.GetCharacterAdvance(icon_font,icon_code)
				if(obj.selected){
					ext_color=obj.sel_file_icon_color
					UI.RoundRect({
						x:obj.x,y:obj.y+2,w:obj.w-12,h:obj.h-4,
						color:sel_bgcolor})
				}
				UI.DrawChar(icon_font,obj.x,obj.y+(obj.h-obj.h_icon)*0.5,ext_color,icon_code)
				var sname=GetSmartFileName(obj)
				var lg_basepath=obj.name.length-sname.length
				if(lg_basepath>0){
					W.Text("",{x:obj.x+w_icon,y:obj.y+4,
						font:obj.name_font,text:obj.name.substr(0,lg_basepath),
						color:obj.selected?obj.sel_basepath_color:obj.basepath_color})
				}
				W.Text("",{x:obj.x+w_icon+UI.MeasureText(obj.name_font,obj.name.substr(0,lg_basepath)).w,y:obj.y+4,
					font:obj.name_font,text:sname,
					color:obj.selected?obj.sel_name_color:obj.name_color})
				if(obj.history_hl_ranges){
					//highlight keywords in history items only
					//var base_offset=obj.selected?0:(obj.name.length-sname.length);
					for(var i=0;i<obj.history_hl_ranges.length;i+=2){
						var p0=obj.history_hl_ranges[i+0];//Math.max(obj.history_hl_ranges[i+0]-base_offset,0);
						var p1=obj.history_hl_ranges[i+1];//Math.max(obj.history_hl_ranges[i+1]-base_offset,0);
						if(p0<p1){
							var x=obj.x+w_icon+UI.MeasureText(obj.name_font,obj.name.substr(0,p0)).w
							W.Text("",{x:x,y:obj.y+4,
								font:obj.name_font_bold,text:obj.name.substr(p0,p1-p0),
								color:obj.selected?obj.sel_name_color:obj.name_color})
						}
					}
				}
				var s_misc_text=(
					obj.name_to_create?
						"Create new file":
						[obj.is_dir?UI._("Folder"):FormatFileSize(obj.size),FormatRelativeTime(obj.time,UI.m_current_file_list.m_now)].join(", ")
					)
				W.Text("",{x:obj.x+w_icon,y:obj.y+30,
					font:obj.misc_font,text:s_misc_text,
					color:obj.selected?obj.sel_misc_color:obj.misc_color})
				if(!desc.file_icon&&!obj.is_dir&&!obj.name_to_create){
					var fnt_size_base=24;
					s_ext=s_ext.toUpperCase()
					if(s_ext==""){s_ext="?";fnt_size_base=32}
					var ext_dims=UI.MeasureText(UI.Font(UI.eng_font_name,fnt_size_base),s_ext)
					var ext_font=UI.Font(UI.eng_font_name,Math.min(24*28/ext_dims.w,fnt_size_base))
					ext_dims=UI.MeasureText(ext_font,s_ext)
					W.Text("",{x:obj.x+(w_icon-ext_dims.w)*0.5,y:obj.y+(obj.h-ext_dims.h)*0.5,
						font:ext_font,text:s_ext,
						color:ext_color})
				}else if(desc.file_icon=="プ"){
					s_ext=s_ext.toUpperCase()
					var ext_dims=UI.MeasureText(UI.Font(UI.eng_font_name,24),s_ext)
					var ext_font=UI.Font(UI.eng_font_name,Math.min(24*24/ext_dims.w,24))
					ext_dims=UI.MeasureText(ext_font,s_ext)
					W.Text("",{x:obj.x+(w_icon*(s_ext.length==1?0.98:1)-ext_dims.w)*0.5,y:obj.y+(obj.h-ext_dims.h)*0.5,
						font:ext_font,text:s_ext,
						color:ext_color})
				}
				/////////////////////////
				var x_tag=obj.x+w_icon+UI.MeasureText(obj.misc_font,s_misc_text).w+obj.tag_padding*2
				var DrawTag=function(sname){
					var tag_dims=UI.MeasureText(obj.misc_font,sname)
					UI.RoundRect({
						color:obj.selected?obj.sel_misc_color:obj.misc_color,border_width:0,
						x:x_tag,y:obj.y+30,w:tag_dims.w+obj.tag_round*2,h:tag_dims.h,
						round:obj.tag_round,
						//color:0,
					})
					W.Text("",{x:x_tag+obj.tag_round,y:obj.y+30,
						font:obj.misc_font,text:sname,
						color:obj.selected?sel_bgcolor:0xffffffff})
					x_tag+=tag_dims.w+obj.tag_padding+obj.tag_round*2
				}
				var repos=g_repo_from_file[obj.name]
				if(repos){
					//git tags
					for(var spath in repos){
						var sname=GetSmartFileName(g_repo_list[spath])
						if(repos[spath]==1){
							DrawTag(sname+'*')
						}else{
							DrawTag(sname)
						}
					}
				}
				/////////////////////////
				//forget button
				if(obj.selected&&UI.m_ui_metadata[obj.name]){
					W.Button("forget_button",{style:obj.button_style,
						x:16,y:0,
						text:"Forget",
						anchor:'parent',anchor_align:'right',anchor_valign:'center',
						OnClick:function(){
							UI.ForgetFile(obj)
						}
					})
				}
			}
		}
	UI.End()
	return obj
}

var FSTreeItem_prototype={
	OnDblClick:function(event){
		//expand or open
		this.owner.OnEnter()
	},
	OnClick:function(event){
		this.owner.selection_y=this.y_abs
		//icon test for dirs
		if(this.is_dir){
			if(event.x-this.x<UI.GetCharacterAdvance(obj.icon_font,0x2b)){
				this.owner.OnEnter();
			}
		}
		UI.Refresh()
	},
}
var DrawFSTreeItem=function(parent, item,x_abs,y_abs){
	var id=parent.counter++;
	var obj=UI.Keep(id,item,FSTreeItem_prototype)
	obj.x=parent.x-parent.visible_scroll_x+x_abs;
	obj.y=parent.y-parent.visible_scroll_y+y_abs;
	obj.w=Math.max(parent.w-(x_abs-parent.visible_scroll_x),0);
	obj.h=parent.h_item;
	obj.y_abs=y_abs
	obj.owner=parent;
	W.PureRegion(id,obj)
	//just icon and name
	var selected=(parent.selection_y==y_abs);
	var ext_color=(desc.file_icon_color||parent.file_icon_color)
	var icon_code=0;
	if(obj.is_dir){
		ext_color=0xffb4771f
		icon_code=(obj.is_dir==1?0x2b:0x2d);//'+-'
	}else{
		var s_ext=UI.GetFileNameExtension(obj.name)
		var language_id=Language.GetNameByExt(s_ext)
		var desc=Language.GetDescObjectByName(language_id)
		icon_code=(desc.file_icon||'档').charCodeAt(0)
	}
	var w_icon=UI.GetCharacterAdvance(parent.icon_font,icon_code)
	if(selected){
		ext_color=parent.sel_file_icon_color
		UI.RoundRect({
			x:obj.x,y:obj.y+2,w:obj.w-12,h:obj.h-4,
			color:sel_bgcolor})
	}
	UI.DrawChar(icon_font,obj.x,obj.y+(obj.h-UI.GetFontHeight(parent.icon_font))*0.5,ext_color,icon_code)
	W.Text("",{x:obj.x+w_icon,y:obj.y+(obj.h-UI.GetFontHeight(parent.name_font))*0.5,
		font:parent.name_font,text:obj.name,
		color:selected?parent.sel_name_color:parent.name_color})
	return obj;
}

var DrawFSTreeView=function(parent, items, x_abs,y0,h){
	var pfile=items.length;
	var y=y0,y_vis=y;
	parent.min_indent=Math.min(parent.min_indent,x_abs);
	for(var i=0;i<items.length;i++){
		var item_i=items[i];
		if(!item_i.is_dir){
			pfile=i;
			break;
		}
		y_vis=y-parent.visible_scroll_y;
		if(y_vis<h&&y_vis+item_i.h>0){
			//visible, draw 
			DrawFSTreeItem(parent, item_i,x_abs,y);
			if(item_i.is_dir==2){
				//expanded, recurse
				DrawFSTreeView(parent,item_i.items,x_abs+parent.w_indent,y+parent.h_item,h);
			}
		}
		y+=item_i.total_size;
	}
	var p0=pfile+(Math.floor(Math.max(-y,0)/parent.h_item)|0);
	var p1=Math.min(pfile+(Math.ceil((h-y)/parent.h_item)|0),items.length);
	for(var i=p0;i<p1;i++){
		var item_i=items[i];
		DrawFSTreeItem(parent, item_i,x_abs,parent.y+y);
		y+=parent.h_item;
	}
}


var FSTreeView_prototype={
	GetItemByYDfs:function(obj,y0,y_pinpoint){
		var items=obj.items;
		var pfile=items.length;
		var y=y0;
		if(this!=obj&&y_pinpoint>=y&&y_pinpoint<y+this.h_item){
			return {'item':obj,'y':y};
		}
		y+=this.h_item;
		for(var i=0;i<items.length;i++){
			var item_i=items[i];
			if(!item_i.is_dir){
				pfile=i;
				break;
			}
			if(y_pinpoint>=y&&(y_pinpoint<y+item_i.total_size||i==items.length-1)){
				//recurse 
				var ret=GetItemByYDfs(item_i,y,y_pinpoint)
				ret.path=item_i.name+'/'+ret.path;
				return ret;
			}
			y+=item_i.total_size;
		}
		var p=Math.min(Math.max(Math.floor((y_pinpoint-y)/this.h_item),0)+pfile,items.length-1);
		y+=(p-pfile)*this.h_item;
		return {'item':items[p],'y':y,'path':items[p].name}
	},
	GetItemByY:function(y_pinpoint){
		return this.GetItemByYDfs(this,0,y_pinpoint);
	},
	HeightDfs:function(obj,y0,y_pinpoint){
		var items=obj.items;
		var pfile=items.length;
		var y=y0+(obj==this?0:this.h_item);
		for(var i=0;i<items.length;i++){
			var item_i=items[i];
			if(!item_i.is_dir){
				pfile=i;
				break;
			}
			if(y_pinpoint==undefined||y_pinpoint>=y&&y_pinpoint<y+item_i.total_size){
				//recurse 
				this.HeightDfs(item_i,y,y_pinpoint==y?undefined:y_pinpoint)
			}
			y+=item_i.total_size;
		}
		y+=(items.length-pfile)*this.h_item;
		obj.total_size=y;
	},
	OnEnter:function(key){
		var item_yabs=this.GetItemByY(this.selection_y);
		var item=item_yabs.item;
		if(!item.is_dir){
			OpenInPlace(this.owner,item.name)
			return;
		}
		item.is_dir=3-item.is_dir;
		if(item.is_dir==1){
			item.items=undefined
		}else{
			var find_context=IO.CreateEnumFileContext(item_yabs.path,3)
			var items=[];
			for(;;){
				var fnext=find_context()
				if(!fnext){
					find_context=undefined;
					break;
				}
				items.push({'name':UI.RemovePath(fnext.name),'is_dir':fnext.is_dir})
			}
			item.items=items
		}
		this.HeightDfs(this,0,item_yabs.y)
	},
	AutoScroll:function(){
		this.scroll_y=Math.min(Math.max(this.scroll_y,this.selection_y),this.selection_y-this.h+this.h_item)
		this.scroll_y=Math.min(Math.max(this.scroll_y,0),this.total_size-this.h+this.h_item)
	},
	SelectAtY:function(y){
		var item_yabs=this.GetItemByY(y);
		this.selection_y=item_yabs.y;
		this.AutoScroll();
		UI.Refresh();
	},
	OnKeyDown:function(){
		if(0){
		}else if(UI.IsHotkey(event,"UP")){
			this.SelectAtY(this.selection_y-this.h_item);
		}else if(UI.IsHotkey(event,"DOWN")){
			this.SelectAtY(this.selection_y+this.h_item);
		}else if(UI.IsHotkey(event,"RETURN")){
			this.OnEnter()
		}else if(UI.IsHotkey(event,"LEFT")){
			this.OnEnter("LEFT")
		}else if(UI.IsHotkey(event,"RIGHT")){
			this.OnEnter("RIGHT")
		}
	},
}
W.FSTreeView=function(id,attrs){
	var obj=UI.StdWidget(id,attrs,"fs_tree_view",FSTreeView_prototype);
	//todo: actually call it
	//todo: top overlay for the over-indented case
	W.PureRegion(id,obj)
	UI.Begin(obj);
		UI.PushCliprect(obj.x,obj.y,obj.w,obj.h)
		if(obj.total_size==undefined){
			obj.HeightDfs(obj,0)
		}
		var scroll_x=(obj.scroll_x||0);
		var scroll_y=(obj.scroll_y||0);
		if(obj.scroll_transition_dt>0){
			var anim=W.AnimationNode("scrolling_animation",{transition_dt:obj.scroll_transition_dt,
				scroll_x:scroll_x,
				scroll_y:scroll_y})
			scroll_x=anim.scroll_x
			scroll_y=anim.scroll_y
		}
		obj.visible_scroll_x=scroll_x
		obj.visible_scroll_y=scroll_y
		obj.counter=0;
		obj.min_indent=1e15;
		if(!obj.selection_y){obj.selection_y=0;}
		DrawFSTreeView(obj, obj.items,0,obj.h);
		if(obj.counter>0){
			obj.scroll_x=Math.max(obj.min_indent-obj.w_indent,0);
		}
		UI.PopCliprect()
	UI.End();
	return obj
}

var fnewpage_findbar_plugin=function(){
	this.AddEventHandler('ESC',function(){
		var obj=this.owner
		if(this.m_close_on_esc){
			UI.top.app.document_area.CloseTab()
			for(var i=0;i<UI.g_all_document_windows.length;i++){
				if(UI.g_all_document_windows[i].file_name==UI.m_previous_document){
					UI.top.app.document_area.SetTab(i)
					break
				}
			}
		}else{
			var editor_widget=obj.owner
			editor_widget.m_is_brand_new=0
			if(editor_widget.m_file_name_before_preview){
				//clear preview
				editor_widget.file_name=editor_widget.m_file_name_before_preview
				editor_widget.doc=undefined
				editor_widget.m_language_id=undefined
				editor_widget.m_is_preview=0
				editor_widget.m_file_name_before_preview=undefined
			}
		}
		UI.m_current_file_list=undefined
		UI.Refresh()
	})
	var fpassthrough=function(key,event){
		var obj=this.owner
		obj.file_list.OnKeyDown(event)
	}
	this.AddEventHandler('change',function(){
		var obj=this.owner
		obj.m_file_list=undefined
		UI.Refresh()
	})
	this.AddEventHandler('RETURN RETURN2',fpassthrough)
	this.AddEventHandler('UP',fpassthrough)
	this.AddEventHandler('DOWN',fpassthrough)
	this.AddEventHandler('PGUP',fpassthrough)
	this.AddEventHandler('PGDN',fpassthrough)
	this.AddEventHandler('TAB',function(key,event){
		var s_search_text=this.ed.GetText()
		var s_path=s_search_text
		var ccnt=Duktape.__byte_length(s_path)
		if(s_path.length&&this.sel0.ccnt==ccnt&&this.sel1.ccnt==ccnt){
			s_path=IO.ProcessUnixFileName(s_path.replace(g_regexp_backslash,"/")).replace(g_regexp_backslash,"/")
			if(s_path.search(g_regexp_abspath)>=0){
				//do nothing: it's absolute
			}else{
				s_path=UI.m_new_document_search_path+"/"+s_path
			}
			if(UI.Platform.ARCH=="win32"||UI.Platform.ARCH=="win64"){
				s_path=s_path.toLowerCase()
			}
			var find_context=IO.CreateEnumFileContext(s_path+"*",3)
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
				if(s_common.length<=s_path.length){break;}
			}
			if(s_common&&s_common.length>s_path.length){
				//path completion
				var s_insertion=s_common.slice(s_path.length)
				this.HookedEdit([ccnt,0,s_insertion])
				this.sel0.ccnt=ccnt+Duktape.__byte_length(s_insertion)
				this.sel1.ccnt=ccnt+Duktape.__byte_length(s_insertion)
				this.CallOnChange()
				this.m_user_just_typed_char=1
			}
		}
	})
}

var g_regexp_backslash=new RegExp("\\\\","g");
var g_regexp_abspath=new RegExp("^(([a-zA-Z]:/)|(/)|[~])");
var FILE_RELEVANCE_SWITCH_SCORE=32
var FILE_RELEVANCE_REPO_SCORE=8
var FILE_RELEVANCE_BASE_SCORE=4
var FILE_RELEVANCE_SCORE_DECAY=0.99
//var FILE_RELEVANCE_SAME_REPO_NON_HIST=16
W.SXS_NewPage=function(id,attrs){
	//todo: proper refreshing on metadata change
	var obj=UI.StdWidget(id,attrs,"sxs_new_page");
	UI.Begin(obj)
		UI.RoundRect(obj)
		////////////////////////////////////////////
		//the find bar
		UI.RoundRect({x:obj.x,y:obj.y,w:obj.w,h:obj.h_find_bar,
			color:obj.find_bar_bgcolor})
		var rect_bar=UI.RoundRect({
			x:obj.x+obj.find_bar_padding,y:obj.y+obj.find_bar_padding,
			w:obj.w-obj.find_bar_padding*2,h:obj.h_find_bar-obj.find_bar_padding*2,
			color:obj.find_bar_color,
			round:obj.find_bar_round})
		UI.DrawChar(UI.icon_font_20,obj.x+obj.find_bar_padding*2,obj.y+(obj.h_find_bar-UI.GetCharacterHeight(UI.icon_font_20))*0.5,
			obj.find_bar_hint_color,'s'.charCodeAt(0))
		var x_find_edit=obj.x+obj.find_bar_padding*3+UI.GetCharacterAdvance(UI.icon_font_20,'s'.charCodeAt(0));
		var w_find_edit=rect_bar.x+rect_bar.w-obj.find_bar_padding-x_find_edit;
		W.Edit("find_bar_edit",{
			style:obj.find_bar_editor_style,
			x:x_find_edit,w:w_find_edit,y:rect_bar.y,h:rect_bar.h,
			owner:obj,
			plugins:[fnewpage_findbar_plugin],
			default_focus:2,
		});
		if(!obj.find_bar_edit.ed.GetTextSize()&&!obj.find_bar_edit.ed.m_IME_overlay){
			W.Text("",{x:x_find_edit+2,w:w_find_edit,y:rect_bar.y,h:rect_bar.h,
				font:obj.find_bar_hint_font,color:obj.find_bar_hint_color,
				text:"Search"})
		}
		////////////////////////////////////////////
		UI.m_current_file_list=obj.m_current_file_list
		var files=obj.m_file_list;
		var first_time=0
		if(!files){
			obj.m_current_file_list={
				m_now:IO.WallClockTime(),
				m_appeared_names:{},
				m_appeared_full_names:{},
				m_listed_git_repos:{},
			}
			UI.m_current_file_list=obj.m_current_file_list
			files=[]
			///////////////////////
			var s_search_text=obj.find_bar_edit.ed.GetText()
			//it's more of a smart interpretation of the user-typed string, not a full-blown explorer
			//history mode
			//only do space split for hist mode
			//if(s_search_text.indexOf('/')<0){
			var hist=UI.m_ui_metadata["<history>"]
			if(hist){
				var hist_keywords=s_search_text.split(" ").filter(function(a){return a.toLowerCase()});
				for(var i=hist.length-1;i>=0;i--){
					var fn_i=hist[i],fn_i_search=fn_i.toLowerCase()
					var is_invalid=0;
					var hl_ranges=[]
					for(var j=0;j<hist_keywords.length;j++){
						var pj=fn_i_search.lastIndexOf(hist_keywords[j]);
						if(pj<0){
							is_invalid=1
							break;
						}
						hl_ranges.push(pj,pj+hist_keywords[j].length)
					}
					if(is_invalid){continue;}
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
				}
			}
			//}
			//sort by relevance
			files.sort(function(a,b){return b.relevance-a.relevance||b.hist_ord-a.hist_ord;});
			//file system part, leave them unsorted
			var s_path=s_search_text
			if(s_path.length||!files.length){
				s_path=IO.ProcessUnixFileName(s_path.replace(g_regexp_backslash,"/")).replace(g_regexp_backslash,"/")
				if(s_path.search(g_regexp_abspath)>=0){
					//do nothing: it's absolute
				}else{
					s_path=UI.m_new_document_search_path+"/"+s_path
					//git project part
					var spath_repo=DetectRepository(s_path+"*")
					if(spath_repo){
						if(!UI.m_current_file_list.m_listed_git_repos[spath_repo]){
							UI.m_current_file_list.m_listed_git_repos[spath_repo]=1
							files.push({git_repo_to_list:spath_repo, search_text:s_search_text})
						}
					}
				}
				files.push({
					name_to_find:s_path+"*",
					create_if_not_found:s_path,
				})
			}
			//////////////
			obj.m_file_list=files
			obj.file_list=undefined
			first_time=1
		}
		UI.m_current_file_list.m_ui_obj=W.ListView('file_list',{
			x:obj.x+4,y:obj.y+obj.h_find_bar+4,w:obj.w-8,h:obj.h-obj.h_find_bar-4,
			mouse_wheel_speed:80,
			dimension:'y',layout_spacing:0,layout_align:'fill',
			OnDemand:W.FileItemOnDemand,
			OnChange:function(value){
				W.ListView_prototype.OnChange.call(this,value)
				this.OpenPreview(value,"explicit")
			},
			OpenPreview:function(value,is_explicit){
				var editor_widget=obj.owner
				if(!editor_widget.m_is_brand_new||!UI.HasFocus(obj.find_bar_edit)&&!is_explicit){return;}
				if(editor_widget.m_file_name_before_preview){
					//clear preview first
					editor_widget.file_name=editor_widget.m_file_name_before_preview
					editor_widget.doc=undefined
					editor_widget.m_language_id=undefined
					editor_widget.m_is_preview=0
					editor_widget.m_file_name_before_preview=undefined
				}
				if(!this.items.length){return;}
				if(!this.items[value].name||this.items[value].is_dir){return;}
				var fn=this.name
				if(!editor_widget.m_file_name_before_preview){
					editor_widget.m_file_name_before_preview=editor_widget.file_name
				}
				editor_widget.file_name=this.items[value].name
				editor_widget.doc=undefined
				editor_widget.m_language_id=undefined
				editor_widget.m_is_brand_new=1
				editor_widget.m_is_preview=1
				UI.InvalidateCurrentFrame()
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
	return obj
}

UI.DrawPrevNextAllButtons=function(obj,x,y, menu,stext,stext2,fprev,fall,fnext){
	menu.AddButtonRow({text:stext},[
		{key:"SHIFT+CTRL+D",text:"edit_up",icon:"上",tooltip:'Prev - '+UI.LocalizeKeyName(UI.TranslateHotkey('SHIFT+CTRL+D')),action:fprev},
		{key:"ALT+A",text:"edit_all",icon:"换",tooltip:'All - '+UI.LocalizeKeyName(UI.TranslateHotkey('ALT+A')),action:fall},
		{key:"CTRL+D",text:"edit_down",icon:"下",tooltip:'Next - '+UI.LocalizeKeyName(UI.TranslateHotkey('CTRL+D')),action:fnext}])
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
		font:UI.icon_font_20,text:"上",tooltip:stext2.replace("@1","prev")+' - '+UI.LocalizeKeyName(UI.TranslateHotkey('SHIFT+CTRL+D')),
		tooltip_placement:'right',
		OnClick:fprev})
	W.Button("button_edit_all",{style:UI.default_styles.check_button,
		x:x_button_box+padding,y:y_button_box+sz_button*1+padding,
		w:sz_button,h:sz_button,
		font:UI.icon_font_20,text:"换",tooltip:stext2.replace("@1","all")+' - '+UI.LocalizeKeyName(UI.TranslateHotkey('ALT+A')),
		tooltip_placement:'right',
		OnClick:fall})
	W.Button("button_edit_down",{style:UI.default_styles.check_button,
		x:x_button_box+padding,y:y_button_box+sz_button*2+padding,
		w:sz_button,h:sz_button,
		font:UI.icon_font_20,text:"下",tooltip:stext2.replace("@1","next")+' - '+UI.LocalizeKeyName(UI.TranslateHotkey('CTRL+D')),
		tooltip_placement:'right',
		OnClick:fnext})
}

UI.ED_ParseMore_callback=function(fn){
	var s_ext=UI.GetFileNameExtension(fn)
	var loaded_metadata=(UI.m_ui_metadata[fn]||{})
	var language_id=(loaded_metadata.m_language_id||Language.GetNameByExt(s_ext))
	var ret=Language.GetDescObjectByName(language_id)
	if(s_ext=="h"){
		var fn_main=UI.GetMainFileName(fn);
		var exts=[".c",".cpp",".cxx",".cc",".C",".m",".cu"]
		for(var i=0;i<exts.length;i++){
			var fn_c=UI.ED_SearchIncludeFile(fn,fn_main+exts[i],ret)
			if(fn_c){UI.ED_ParserQueueFile(fn_c)}
		}
	}
	return ret
}

UI.ED_SearchIncludeFile=function(fn_base,fn_include,options){
	if(UI.Platform.ARCH=="win32"||UI.Platform.ARCH=="win64"){
		fn_include=fn_include.toLowerCase().replace("\\","/")
	}
	var fn_include_length=fn_include.length
	//base path
	var spath=UI.GetPathFromFilename(fn_base)
	var fn=(spath+"/"+fn_include);
	if(IO.FileExists(fn)){return fn}
	//git
	DetectRepository(fn_base)
	var repos=g_repo_from_file[fn_base]
	if(repos){
		for(var spath in repos){
			var files=g_repo_list[spath].files
			for(var i=0;i<files.length;i++){
				var fn_i=files[i]
				if(UI.Platform.ARCH=="win32"||UI.Platform.ARCH=="win64"){
					fn_i=fn_i.toLowerCase().replace("\\","/")
				}
				if(fn_i.length<fn_include_length){continue;}
				if(fn_i.substr(fn_i.length-fn_include_length)==fn_include&&IO.FileExists(fn_i)){
					return fn_i
				}
			}
		}
	}
	//standard include paths
	if(options.include_paths){
		var paths=options.include_paths
		for(var i=0;i<paths.length;i++){
			var fn=paths[i]+'/'+fn_include
			if(IO.FileExists(fn)){return fn}
		}
	}
	return ''
}

var MAX_PARSABLE_FCALL=4096
W.CodeEditor=function(id,attrs){
	var tick0
	if(UI.enable_timing){
		tick0=Duktape.__ui_get_tick()
	}
	var obj=UI.StdWidget(id,attrs,"code_editor",W.CodeEditorWidget_prototype);
	if(obj.m_is_brand_new&&obj.doc&&UI.HasFocus(obj.doc)){
		if(obj.m_file_name_before_preview){
			obj.file_name=obj.m_file_name_before_preview
			obj.doc=undefined
			obj.m_language_id=undefined
			obj.m_is_preview=0
			obj.m_file_name_before_preview=undefined
		}
	}
	if(!obj.m_language_id){
		var s_ext=UI.GetFileNameExtension(obj.file_name)
		obj.m_language_id=Language.GetNameByExt(s_ext)
	}
	var sxs_visualizer=obj.m_sxs_visualizer;
	var w_obj_area=obj.w
	var h_obj_area=obj.h
	var x_sxs_area=0
	var y_sxs_area=0
	var w_sxs_area=0
	var h_sxs_area=0
	var sxs_area_dim=undefined
	if(obj.m_is_brand_new){
		sxs_visualizer=W.SXS_NewPage
	}
	if(sxs_visualizer&&!obj.hide_sxs_visualizer){
		if(w_obj_area>=h_obj_area){
			w_obj_area*=0.618
			x_sxs_area=obj.x+w_obj_area
			y_sxs_area=obj.y
			w_sxs_area=obj.w-w_obj_area
			h_sxs_area=obj.h
			sxs_area_dim='x'
		}else{
			h_obj_area*=0.618
			x_sxs_area=obj.x
			y_sxs_area=obj.y+h_obj_area
			w_sxs_area=obj.w
			h_sxs_area=obj.h-h_obj_area
			sxs_area_dim='y'
		}
	}
	//prevent m_current_file_list leaks
	UI.m_current_file_list=undefined
	UI.Begin(obj)
		//main code area
		obj.h_obj_area=h_obj_area
		var doc=obj.doc
		var prev_h_top_hint=(obj.h_top_hint||0),h_top_hint=0,w_line_numbers=0,w_scrolling_area=0,y_top_hint_scroll=0;
		var h_scrolling_area=h_obj_area
		var h_top_find=0,h_bottom_find=0
		var editor_style=UI.default_styles.code_editor.editor_style
		var top_hint_bbs=[]
		var current_find_context=obj.m_current_find_context
		var ytot
		if(doc){
			//scrolling and stuff
			var ccnt_tot=doc.ed.GetTextSize()
			var ytot=doc.ed.XYFromCcnt(ccnt_tot).y+doc.ed.GetCharacterHeightAt(ccnt_tot);
			if(h_obj_area<ytot&&!obj.m_is_preview){
				w_scrolling_area=obj.w_scroll_bar
				if(obj.show_minimap){
					w_scrolling_area+=obj.w_minimap+obj.padding
				}
			}
			if(w_obj_area<=w_line_numbers+w_scrolling_area){
				w_scrolling_area=0
				if(w_obj_area<=w_line_numbers){
					w_line_numbers=w_obj_area*0.5
				}
			}
			//top hint in a separate area
			if(obj.show_top_hint&&!obj.show_find_bar){
				var top_hints=[];
				var rendering_ccnt0=doc.SeekXY(doc.scroll_x,doc.scroll_y)
				var ccnt=doc.GetEnhancedHome(doc.sel1.ccnt)
				//prev_h_top_hint
				for(;;){
					var ccnti=ccnt
					ccnt=doc.FindOuterLevel(ccnti)
					if(ccnt<0||ccnt>=ccnti){break}
					if(ccnt<rendering_ccnt0){
						top_hints.push(ccnt)
					}
					if(top_hints.length>=obj.top_hint_max_levels){break;}
				}
				if(top_hints.length){
					//convert to bbs
					var top_hint_inv=[];
					for(var i=top_hints.length-1;i>=0;i--){
						top_hint_inv.push(top_hints[i]);
					}
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
				}
			}else{
				h_top_hint=0
			}
			//if(UI.nd_captured){
			//	h_top_hint=prev_h_top_hint;//don't change it while scrolling
			//}
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
			if(!doc.cur_line_hl){
				var hl_items=doc.CreateTransientHighlight({'depth':-100,'color':obj.color_cur_line_highlight,'invertible':0});
				doc.cur_line_p0=hl_items[0]
				doc.cur_line_p1=hl_items[1]
				doc.cur_line_hl=hl_items[2]
			}
			var line_current=doc.GetLC(doc.sel1.ccnt)[0]
			var ed_caret=doc.GetCaretXY();
			//var line_ccnts=doc.SeekAllLinesBetween(line_current,line_current+2)
			doc.cur_line_p0.ccnt=doc.SeekXY(0,ed_caret.y);
			doc.cur_line_p1.ccnt=doc.SeekXY(1e17,ed_caret.y);
			//find highlight
			if(!obj.show_find_bar&&UI.m_ui_metadata.find_state.m_current_needle&&!obj.m_hide_find_highlight){
				//repeat the animation to get correct the correct scrolling information
				UI.Begin(doc)
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
				if(obj.show_minimap){
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
				obj.ResetFindingContext(UI.m_ui_metadata.find_state.m_current_needle,UI.m_ui_metadata.find_state.m_find_flags, Math.min(Math.max(rendering_ccnt0,doc.SeekLC(doc.GetLC(doc.sel1.ccnt)[0],0)),rendering_ccnt1))
				var ctx=obj.m_current_find_context
				current_find_context=ctx
				//print(UI.GetSearchFrontierCcnt(ctx.m_backward_frontier),UI.GetSearchFrontierCcnt(ctx.m_forward_frontier),ctx.m_backward_frontier,ctx.m_forward_frontier,ctx.m_flags)
				if(!UI.IsSearchFrontierCompleted(ctx.m_backward_frontier)&&UI.GetSearchFrontierCcnt(ctx.m_backward_frontier)>rendering_ccnt0){
					ctx.m_backward_frontier=UI.ED_Search(doc.ed,ctx.m_backward_frontier,-1,ctx.m_needle,ctx.m_flags,65536,ctx.ReportMatchBackward,ctx)
					UI.Refresh()
				}
				if(!UI.IsSearchFrontierCompleted(ctx.m_forward_frontier)&&UI.GetSearchFrontierCcnt(ctx.m_forward_frontier)<rendering_ccnt1){
					ctx.m_forward_frontier=UI.ED_Search(doc.ed,ctx.m_forward_frontier,1,ctx.m_needle,ctx.m_flags,65536,ctx.ReportMatchForward,ctx);
					UI.Refresh()
				}
			}
		}
		//hopefully 8 is the widest char
		if(obj.show_line_numbers){
			var lmax=(doc?doc.GetLC(doc.ed.GetTextSize())[0]:0)+1
			w_line_numbers=lmax.toString().length*UI.GetCharacterAdvance(obj.line_number_font,56);
		}
		var w_bookmark=UI.GetCharacterAdvance(obj.bookmark_font,56)+4
		w_line_numbers+=obj.padding+w_bookmark;
		if(obj.show_find_bar&&current_find_context){
			UI.RoundRect({color:obj.find_mode_bgcolor,x:obj.x,y:obj.y,w:w_obj_area,h:h_obj_area})
			UI.RoundRect({color:obj.bgcolor,x:obj.x+w_obj_area-w_scrolling_area,y:obj.y,w:w_scrolling_area,h:h_obj_area})
		}else{
			UI.RoundRect({color:obj.line_number_bgcolor,x:obj.x,y:obj.y,w:w_line_numbers,h:h_obj_area})
			UI.RoundRect({color:obj.bgcolor,x:obj.x+w_line_numbers,y:obj.y,w:w_obj_area-w_line_numbers,h:h_obj_area})
		}
		if(doc&&doc.ed.hfile_loading){
			//loading progress
			obj.CreateNotification({
				id:'loading_progress',
				icon:undefined,
				progress:doc.ed.hfile_loading.progress,
				text:"Loading @1%...".replace('@1',(doc.ed.hfile_loading.progress*100).toFixed(0))},"quiet")
		}else{
			obj.DismissNotification('loading_progress')
		}
		var DrawLineNumbers=function(scroll_x,scroll_y,area_w,area_y,area_h){
			var hc=UI.GetCharacterHeight(doc.font)
			if(bm_xys){
				UI.PushCliprect(obj.x,area_y,w_obj_area,area_h)
				for(var i=0;i<bm_ccnts.length;i++){
					var y=bm_xys[i*2+1]-scroll_y+area_y
					var id=bm_ccnts[i][0]
					UI.RoundRect({x:2,y:y+4,w:w_line_numbers-4,h:hc-8,
						color:obj.bookmark_color,
						border_color:obj.bookmark_border_color,
						border_width:Math.min(hc/8,2),
						round:4})
					if(id>=0){
						UI.DrawChar(obj.bookmark_font,4,y+4,obj.bookmark_text_color,48+id)
					}
				}
				UI.PopCliprect()
			}
			if(obj.show_line_numbers){
				var rendering_ccnt0=doc.SeekXY(scroll_x,scroll_y)
				var rendering_ccnt1=doc.SeekXY(scroll_x+area_w,scroll_y+area_h)
				var dy_line_number=(UI.GetCharacterHeight(doc.font)-UI.GetCharacterHeight(obj.line_number_font))*0.5;
				var line0=doc.GetLC(rendering_ccnt0)[0];
				var line1=doc.GetLC(rendering_ccnt1)[0];
				var line_ccnts=doc.SeekAllLinesBetween(line0,line1+1,"valid_only");
				var line_xys=doc.ed.GetXYEnMasse(line_ccnts)
				var diff=doc.m_diff_from_save
				UI.PushCliprect(obj.x,area_y,w_obj_area,area_h)
				for(var i=0;i<line_ccnts.length;i++){
					if(line_ccnts[i]<0){continue;}
					if(i&&line_ccnts[i]==line_ccnts[i-1]){break;}
					var s_line_number=(line0+i+1).toString();
					var y=line_xys[i*2+1]-scroll_y+dy_line_number+area_y
					var text_dim=UI.MeasureText(obj.line_number_font,s_line_number)
					var x=w_line_numbers-text_dim.w-obj.padding
					if(diff){
						var ccnt_line_next=-1;
						for(var j=i+1;j<line_ccnts.length;j++){
							if(line_ccnts[j]>=0){
								ccnt_line_next=line_ccnts[j]
								break
							}
						}
						if(ccnt_line_next<0){
							ccnt_line_next=doc.SeekLC(line1+1,0)
						}
						if(diff.RangeQuery(line_ccnts[i],ccnt_line_next)){
							//line modified
							//s_line_number=s_line_number+"*";
							UI.RoundRect({
								x:obj.x+w_line_numbers-6,y:line_xys[i*2+1]-scroll_y+area_y,
								w:6,h:Math.min(Math.max((line_xys[i*2+3]-line_xys[i*2+1])||hc,hc),area_h),
								color:obj.color_diff_tag})
						}
					}
					W.Text("",{x:obj.x+x,y:y, font:obj.line_number_font,text:s_line_number,color:line0+i==line_current?obj.line_number_color_focus:obj.line_number_color})
				}
				UI.PopCliprect()
			}
		}
		var bm_ccnts=undefined,bm_xys=undefined;
		var PrepareBookmarks=function(){
			//prepare bookmarks - they appear under line numbers
			bm_ccnts=[]
			for(var i=0;i<doc.m_bookmarks.length;i++){
				var bm=doc.m_bookmarks[i];
				if(bm){
					bm_ccnts.push([i,bm.ccnt])
				}
			}
			var bm_filtered=[];
			for(var i=0;i<doc.m_unkeyed_bookmarks.length;i++){
				var bm=doc.m_unkeyed_bookmarks[i];
				if(bm){
					bm_ccnts.push([-1,bm.ccnt])
					bm_filtered.push(bm)
				}
			}
			doc.m_unkeyed_bookmarks=bm_filtered;
			if(bm_ccnts.length){
				bm_ccnts.sort(function(a,b){return (a[1]*10+a[0])-(b[1]*10+b[0]);});
				bm_xys=doc.ed.GetXYEnMasse(bm_ccnts.map(function(a){return a[1]}))
			}
		}
		obj.w_line_numbers=w_line_numbers
		var f_draw_accands=undefined
		if(doc){
			var renderer=doc.ed.GetHandlerByID(doc.ed.m_handler_registration["renderer"]);
			renderer.m_virtual_diffs=undefined;
		}
		if(doc&&obj.m_edit_lock){
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
			doc.ed.Render({x:doc.visible_scroll_x,y:doc.visible_scroll_y,
				w:doc.w/doc.scale,h:doc.h/doc.scale, 
				scr_x:doc.x*UI.pixels_per_unit,scr_y:doc.y*UI.pixels_per_unit,
				scale:UI.pixels_per_unit, obj:doc});
			//////////////////
			PrepareBookmarks()
			DrawLineNumbers(doc.visible_scroll_x,doc.visible_scroll_y,doc.w,doc.y,doc.h);
		}else{
			if(obj.show_find_bar){
				h_top_find+=obj.h_find_bar
				obj.m_hide_find_highlight=0;
			}
			//individual lines, each with a box and a little shadow for separation
			var h_max_find_items_per_side=(h_obj_area-obj.h_find_bar)*obj.find_item_space_percentage*0.5
			var h_find_item_middle=h_obj_area-obj.h_find_bar-h_max_find_items_per_side*2
			//var find_ranges_back=undefined;
			//var find_ranges_forward=undefined;
			var find_item_scroll_x=undefined
			var w_document=w_obj_area-w_scrolling_area-w_line_numbers
			var DrawFindItemBox=function(y,h){
				UI.RoundRect({color:obj.line_number_bgcolor,x:0,y:y,w:w_line_numbers,h:h})
				UI.RoundRect({color:obj.bgcolor,x:0+w_line_numbers,y:y,w:(w_obj_area-w_scrolling_area)/obj.find_item_scale,h:h})
				UI.RoundRect({x:0,y:y,w:(w_obj_area-w_scrolling_area)/obj.find_item_scale,h:h,
					color:0,border_color:obj.find_item_border_color,border_width:obj.find_item_border_width})
				UI.PushCliprect(0,y+h,(w_obj_area-w_scrolling_area)/obj.find_item_scale,obj.find_item_separation)
					UI.RoundRect({x:0-obj.find_item_shadow_size,y:y+h-obj.find_item_shadow_size,w:(w_obj_area-w_scrolling_area)/obj.find_item_scale+obj.find_item_shadow_size*2,h:obj.find_item_shadow_size*2,
						color:obj.find_item_shadow_color,
						round:obj.find_item_shadow_size,
						border_width:-obj.find_item_shadow_size})
				UI.PopCliprect()
			}
			var DrawFindItemHighlight=function(y,h,highlight_alpha){
				var alpha=Math.max(Math.min(((1-highlight_alpha)*64)|0,255),0)
				UI.RoundRect({color:(obj.find_mode_bgcolor&0xffffff)|(alpha<<24),x:0,y:y,w:(w_obj_area-w_scrolling_area)/obj.find_item_scale,h:h})
			}
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
				if(!doc){
					//early meta-data load for wrap_width
					var loaded_metadata=(UI.m_ui_metadata[obj.file_name]||{})
					for(var i=0;i<UI.m_code_editor_persistent_members.length;i++){
						var name_i=UI.m_code_editor_persistent_members[i]
						var value_i=loaded_metadata[name_i]
						if(value_i!=undefined){obj[name_i]=value_i;}
					}
				}
				var wrap_width=(obj.m_enable_wrapping?obj.m_current_wrap_width:0)
				if(obj.m_is_preview){
					wrap_width=Math.min(wrap_width,w_obj_area-w_line_numbers-obj.padding-w_scrolling_area)
				}
				W.Edit("doc",{
					///////////////
					language:Language.GetDefinitionByName(obj.m_language_id),
					plugin_language_desc:Language.GetDescObjectByName(obj.m_language_id),
					style:editor_style,
					wrap_width:wrap_width,
					///////////////
					x:obj.x+w_line_numbers+obj.padding,y:obj.y+h_top_find,w:w_obj_area-w_line_numbers-obj.padding-w_scrolling_area,h:h_obj_area-h_top_find-h_bottom_find,
					///////////////
					owner:obj,
					m_is_preview:obj.m_is_preview,
					m_file_name:obj.file_name,
					m_is_main_editor:1,
				},W.CodeEditor_prototype);
				if(UI.enable_timing){
					print('before bookmark and ln=',(Duktape.__ui_seconds_between_ticks(tick0,Duktape.__ui_get_tick())*1000).toFixed(2),'ms')
				}
				//line number bar shadow when x scrolled
				if(doc){
					var x_shadow_size_max=obj.x_scroll_shadow_size
					var x_shadow_size=Math.min(doc.visible_scroll_x/8,x_shadow_size_max)
					if(x_shadow_size>0){
						UI.PushCliprect(obj.x+w_line_numbers,obj.y,w_obj_area-w_scrolling_area-w_line_numbers,h_obj_area)
						UI.RoundRect({
							x:obj.x+w_line_numbers-x_shadow_size_max*2+x_shadow_size,
							y:obj.y-x_shadow_size_max,
							w:2*x_shadow_size_max, 
							h:h_obj_area+x_shadow_size_max*2,
							round:x_shadow_size_max,
							border_width:-x_shadow_size_max,
							color:obj.x_scroll_shadow_color})
						UI.PopCliprect()
					}
				}
				//status overlay
				if(doc){
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
					var status_x=obj.x+w_obj_area-w_scrolling_area-status_dims.w-obj.status_bar_padding*2;
					var status_y=obj.y+h_obj_area-status_dims.h-obj.status_bar_padding*2;
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
				//initiate progressive loading
				//Init
				doc=obj.doc
				obj.OnEditorCreate()
				UI.InvalidateCurrentFrame()
				UI.Refresh()
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
				obj.DismissNotification('replace_hint')
				if(rctx.m_needle==s_replace){
					obj.DismissNotification('find_result')
				}else{
					obj.CreateNotification({
						id:'find_result',text:[rctx.m_needle,'  \u2193',s_replace].join("\n")
					},"quiet")
				}
			}
			PrepareBookmarks()
			//generic drawing function
			var line_current=doc.GetLC(doc.sel1.ccnt)[0]
			//the find bar and stuff
			if(obj.show_find_bar&&current_find_context){
				//draw the find items
				doc.ed.m_other_overlay=undefined
				UI.PushSubWindow(obj.x,obj.y+obj.h_find_bar,w_obj_area-w_scrolling_area,h_obj_area-obj.h_find_bar,obj.find_item_scale)
				var hc=UI.GetCharacterHeight(doc.font)
				var w_find_items=(w_obj_area-w_scrolling_area)/obj.find_item_scale, h_find_items=(h_obj_area-obj.h_find_bar)/obj.find_item_scale-obj.find_item_expand_current*hc;
				var h_expand_max=hc*obj.find_item_expand_current
				var render_secs=0,ln_secs=0;
				//DrawItem
				var renderer=doc.ed.GetHandlerByID(doc.ed.m_handler_registration["renderer"]);
				renderer.m_enable_hidden=0
				obj.RenderVisibleFindItems(w_line_numbers+obj.padding,w_find_items,h_find_items,function(find_item_i,find_scroll_x,find_scroll_y,h_expand){
					var doc_h=find_item_i.shared_h+h_expand
					var doc_scroll_y=Math.max(Math.min(find_item_i.scroll_y-h_expand*0.5,ytot-doc_h),0)
					DrawFindItemBox(find_item_i.visual_y-find_scroll_y-h_expand*0.5,doc_h)
					var tick0=Duktape.__ui_get_tick()
					doc.ed.Render({x:find_scroll_x,y:doc_scroll_y,w:w_find_items,h:doc_h,
						scr_x:(w_line_numbers+obj.padding)*UI.pixels_per_unit,scr_y:(find_item_i.visual_y-find_scroll_y-h_expand*0.5)*UI.pixels_per_unit, scale:UI.pixels_per_unit, obj:doc});
					var tick1=Duktape.__ui_get_tick()
					DrawLineNumbers(find_scroll_x,doc_scroll_y,
						doc.w,find_item_i.visual_y-find_scroll_y-h_expand*0.5,doc_h);
					var tick2=Duktape.__ui_get_tick()
					render_secs+=Duktape.__ui_seconds_between_ticks(tick0,tick1)
					ln_secs+=Duktape.__ui_seconds_between_ticks(tick1,tick2)
					DrawFindItemHighlight(find_item_i.visual_y-find_scroll_y-h_expand*0.5,doc_h,h_expand/h_expand_max)
				})
				renderer.m_enable_hidden=1
				if(!current_find_context.m_forward_matches.length&&!current_find_context.m_backward_matches.length&&
				current_find_context.m_needle.length&&
				!(current_find_context.m_flags&(UI.SEARCH_FLAG_REGEXP|UI.SEARCH_FLAG_FUZZY|UI.SEARCH_FLAG_GOTO_MODE))){
					if(UI.IsSearchFrontierCompleted(current_find_context.m_forward_frontier)&&UI.IsSearchFrontierCompleted(current_find_context.m_backward_frontier)){
						//print("fuzzy search reset")
						obj.ResetFindingContext(current_find_context.m_needle,current_find_context.m_find_flags|UI.SEARCH_FLAG_FUZZY)
						UI.Refresh()
					}
				}
				//print(render_secs*1000,ln_secs*1000)
				UI.PopSubWindow()
			}else{
				//line numbers
				DrawLineNumbers(doc.visible_scroll_x,doc.visible_scroll_y,doc.w,doc.y,doc.h);
				//function prototype hint
				var got_overlay_before=!!doc.ed.m_other_overlay;
				var fhctx=obj.m_fhint_ctx
				var s_fhint=undefined
				if(doc.sel0.ccnt==doc.sel1.ccnt&&obj.show_auto_completion&&doc.m_user_just_typed_char){
					var ccnt_fcall_bracket=doc.FindOuterBracket(doc.sel1.ccnt,-1)
					if(!(fhctx&&fhctx.m_ccnt_fcall_bracket==ccnt_fcall_bracket)){
						//context changed, detect new fcall
						fhctx=undefined
						if(ccnt_fcall_bracket>=0&&doc.ed.GetUtf8CharNeighborhood(ccnt_fcall_bracket)[1]=='('.charCodeAt(0)){
							var ccnt_fcall_word1=doc.ed.MoveToBoundary(ccnt_fcall_bracket+1,-1,"word_boundary_right")
							if(ccnt_fcall_word1>=0){
								var ccnt_fcall_word0=doc.ed.MoveToBoundary(ccnt_fcall_word1,-1,"word_boundary_left")
								if(ccnt_fcall_word0>=0){
									var function_id=doc.ed.GetText(ccnt_fcall_word0,ccnt_fcall_word1-ccnt_fcall_word0);
									var prototypes=UI.ED_QueryPrototypeByID(doc,function_id)
									if(prototypes){
										fhctx={
											m_prototypes:prototypes,
											m_ccnt_fcall_bracket:ccnt_fcall_bracket
										}
									}
								}
							}
						}
						obj.m_fhint_ctx=fhctx
					}
					if(fhctx&&doc.sel1.ccnt-ccnt_fcall_bracket<MAX_PARSABLE_FCALL){
						var ccnt_rbracket=doc.ed.MoveToBoundary(doc.sel1.ccnt,1,"space")
						if(doc.ed.GetUtf8CharNeighborhood(ccnt_rbracket)[1]==')'.charCodeAt(0)){
							//do the parsing in native code, GetStateAt then ComputeCharColorID, then do the deed
							var n_commas=UI.ED_CountCommas(doc.ed,ccnt_fcall_bracket,doc.sel1.ccnt)
							if(n_commas!=undefined){
								var prototypes=fhctx.m_prototypes
								for(var i=0;i<prototypes.length;i++){
									var proto_i=prototypes[i]
									if(n_commas>=proto_i.length){continue;}
									var ccnt_lcomma=doc.ed.MoveToBoundary(doc.sel1.ccnt,-1,"space")
									var ch_prev=String.fromCharCode(doc.ed.GetUtf8CharNeighborhood(ccnt_lcomma)[0]);
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
				}else{
					if(fhctx){
						obj.m_fhint_ctx=undefined
					}
				}
				//auto-completion
				doc.ed.m_other_overlay=undefined
				if(doc.sel0.ccnt==doc.sel1.ccnt&&obj.show_auto_completion&&(doc.m_user_just_typed_char||doc.plugin_language_desc.default_hyphenator_name)){
					var acctx=obj.m_ac_context
					var ac_was_actiavted=0
					var had_some_ac_to_display=0
					if(acctx&&acctx.m_ccnt!=doc.sel1.ccnt){
						//if(acctx.m_n_cands>0){
						//	UI.InvalidateCurrentFrame()
						//	UI.Refresh()
						//}
						had_some_ac_to_display=(acctx.m_n_cands>0)
						ac_was_actiavted=acctx.m_activated
						acctx=undefined;
					}
					if(!acctx){
						var accands=undefined;
						var is_spell_mode=0
						if(doc.m_user_just_typed_char){
							if(!(doc.plugin_language_desc.parser=="C"&&!doc.IsBracketEnabledAt(doc.sel1.ccnt))){
								accands=UI.ED_QueryAutoCompletion(doc,doc.sel1.ccnt);
							}
						}else{
							//tex mode - it's actually a spelling suggestion
							//var ccnt_word=doc.sel1.ccnt
							//var ccnt_word0=doc.SnapToValidLocation(doc.ed.MoveToBoundary(doc.ed.SnapToCharBoundary(ccnt_word,-1),-1,"word_boundary_left"),-1)
							//var ccnt_word1=doc.SnapToValidLocation(doc.ed.MoveToBoundary(doc.ed.SnapToCharBoundary(ccnt_word,1),1,"word_boundary_right"),1)
							accands={length:0,at:function(id){return this.suggestions[id]},suggestions:[],s_prefix:""}
							is_spell_mode=1
							//if(ccnt_word0+1<ccnt_word1){
							var renderer=doc.ed.GetHandlerByID(doc.ed.m_handler_registration["renderer"]);
							//accands.s_prefix=doc.ed.GetText(ccnt_word0,ccnt_word1-ccnt_word0)
							var spell_ctx=renderer.HunspellSuggest(doc.ed,doc.sel1.ccnt)
							if(spell_ctx){
								var suggestions=spell_ctx.suggestions
								accands.s_prefix=spell_ctx.s_prefix
								suggestions.push("Add '@1' to dictionary".replace("@1",accands.s_prefix))
								accands.suggestions=suggestions.map(function(a){return {name:a,weight:1}})
								accands.length=suggestions.length
								accands.ccnt0=spell_ctx.ccnt0
							}
							//}
						}
						acctx={
							m_is_spell_mode:is_spell_mode,
							m_ccnt:doc.sel1.ccnt,
							m_accands:accands,
							m_scroll_i:0,
							m_display_items:[],
							m_n_cands:accands?accands.length:0,
							m_x_current:obj.accands_padding*0.5,
							m_selection:0,
							GetDisplayItem:function(id){
								var ret=this.m_display_items[id]
								if(!ret){
									UI.assert(id==this.m_display_items.length,"panic: not doing acctx sequentially")
									var cc=this.m_accands.at(id);
									//ignore weight for now: cc.weight
									ret={
										x:this.m_x_current,
										w:UI.MeasureText(obj.accands_font,cc.name).w,
										name:cc.name
									}
									this.m_x_current+=ret.w+obj.accands_padding
									this.m_display_items[id]=ret
								}
								return ret
							},
							Activate:function(){
								if(!this.m_n_cands){return;}
								this.m_activated=1;
								UI.Refresh()
							},
							Confirm:function(id){
								var s_prefix=this.m_accands.s_prefix
								if(is_spell_mode&&id==this.m_n_cands-1){
									//coulddo: remove, or just give a "user-dic-editing" option
									var renderer=doc.ed.GetHandlerByID(doc.ed.m_handler_registration["renderer"]);
									renderer.HunspellAddWord(s_prefix);
									obj.m_ac_context=undefined
									UI.Refresh();
									return;
								}
								var lg=Duktape.__byte_length(s_prefix);
								if(id==undefined){lg=0;}
								var ccnt0=doc.sel1.ccnt-lg
								if(is_spell_mode){
									ccnt0=this.m_accands.ccnt0
								}
								var sname=(id==undefined?this.m_accands.m_common_prefix:this.m_accands.at(id).name)
								if(doc.plugin_language_desc.default_hyphenator_name){
									sname=UI.ED_CopyCase(sname,sname.toLowerCase(),sname.toUpperCase(),s_prefix)
								}
								var lg2=Duktape.__byte_length(sname);
								doc.HookedEdit([ccnt0,lg,sname])
								if(!this.m_accands.m_common_prefix){
									obj.m_ac_context=undefined
									doc.m_user_just_typed_char=0
								}else{
									obj.m_ac_context.m_ccnt=-1;
									doc.m_user_just_typed_char=1
								}
								doc.sel0.ccnt=ccnt0+lg2
								doc.sel1.ccnt=ccnt0+lg2
								doc.CallOnChange()
								if(this.m_accands.m_common_prefix){
									this.m_activated=1
								}
								//if(this.m_accands.m_auto_activate_after_tab){
								//	this.m_activated=1
								//}
								doc.m_user_just_typed_char=1
								//obj.m_ac_context=undefined
								UI.Refresh()
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
						}
						var got_some_ac_to_display=(acctx.m_n_cands>0)
						obj.m_ac_context=acctx
						if(got_some_ac_to_display||had_some_ac_to_display){
							UI.InvalidateCurrentFrame()
						}
						UI.Refresh()
					}
					if(!obj.show_find_bar){
						if(acctx.m_n_cands>1){
							if(ac_was_actiavted){
								acctx.Activate()
							}
							f_draw_accands=function(){
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
									var selected=(acctx.m_activated&&i==acctx.m_selection)
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
									}
									W.Text("",{x:x_item,y:y_accands_text,
										font:obj.accands_font,text:dii.name,
										color:selected?obj.accands_text_sel_color:obj.accands_text_color})
									//coulddo: a shaking arrow with a big "TAB"
									UI.DrawChar(obj.accands_id_font,
										x_item-obj.accands_sel_padding*0.5-w_hint_char,y_accands_text,
										selected?obj.accands_text_sel_color:obj.accands_text_color,48+num_id)
									if(acctx.m_activated){
										//W.Hotkey("",{key:String.fromCharCode(48+num_id),action:(function(i){return function(){
										//	acctx.Confirm(i)
										//}})(i)})
										doc.AddTransientHotkey(String.fromCharCode(48+num_id),(function(i){return function(){
											acctx.Confirm(i)
										}})(i))
									}
								}
								UI.PopCliprect()
							}
						}
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
				}else{
					var acctx=obj.m_ac_context
					if(acctx){
						obj.m_ac_context=undefined
						UI.InvalidateCurrentFrame()
						UI.Refresh()
					}
				}
				if(s_fhint){
					if(doc.ed.m_other_overlay){
						doc.ed.m_other_overlay.text=doc.ed.m_other_overlay.text+s_fhint
					}else{
						doc.ed.m_other_overlay={'type':'AC','text':s_fhint}
					}
				}
				if(got_overlay_before&&!doc.ed.m_other_overlay){
					UI.InvalidateCurrentFrame()
					UI.Refresh()
				}
				////////////////
				//the top hint, do it after since its Render screws the spell checks
				if(top_hint_bbs.length){
					var y_top_hint=y_top_hint_scroll;
					UI.RoundRect({color:obj.line_number_bgcolor,x:obj.x,y:obj.y,w:w_line_numbers,h:h_top_hint})
					UI.RoundRect({color:obj.bgcolor,x:obj.x+w_line_numbers,y:obj.y,w:w_obj_area-w_line_numbers,h:h_top_hint})
					var renderer=doc.ed.GetHandlerByID(doc.ed.m_handler_registration["renderer"]);
					renderer.m_enable_hidden=0
					for(var bbi=0;bbi<top_hint_bbs.length;bbi+=2){
						var y0=top_hint_bbs[bbi]
						var y1=top_hint_bbs[bbi+1]
						var hh=Math.min(y1-y0,h_top_hint-y_top_hint)
						if(hh>=0){
							//print('draw',y0,(obj.y+y_top_hint)*UI.pixels_per_unit,doc.ed.SeekXY(0,y0))
							doc.ed.Render({x:0,y:y0,w:w_obj_area-w_line_numbers-w_scrolling_area,h:hh,
								scr_x:(obj.x+w_line_numbers+obj.padding)*UI.pixels_per_unit,
								scr_y:(obj.y+y_top_hint)*UI.pixels_per_unit, 
								scale:UI.pixels_per_unit, obj:doc});
							//also draw the line numbers
							DrawLineNumbers(0,y0,1,obj.y+y_top_hint,y1-y0);
						}
						y_top_hint+=y1-y0;
					}
					renderer.m_enable_hidden=1
					UI.PushCliprect(obj.x,obj.y+h_top_hint,w_obj_area-w_scrolling_area,h_obj_area-h_top_hint)
					//a (shadowed) separation bar
					UI.RoundRect({
						x:obj.x-obj.top_hint_shadow_size, y:obj.y+h_top_hint-obj.top_hint_shadow_size, w:w_obj_area-w_scrolling_area+2*obj.top_hint_shadow_size, h:obj.top_hint_shadow_size*2,
						round:obj.top_hint_shadow_size,
						border_width:-obj.top_hint_shadow_size,
						color:obj.top_hint_shadow_color})
					UI.RoundRect({
						x:obj.x, y:obj.y+h_top_hint, w:w_obj_area-w_scrolling_area, h:obj.top_hint_border_width,
						color:obj.top_hint_border_color})
					UI.PopCliprect()
				}
			}
			if(obj.show_find_bar){
				//print(obj.disclaimer_animation&&obj.disclaimer_animation.alpha)
				var disclaimer_animation=W.AnimationNode("disclaimer_animation",{
					transition_dt:obj.disclaimer_transition_dt,
					alpha:(current_find_context&&(current_find_context.m_flags&UI.SEARCH_FLAG_FUZZY?1.0:0.0)),})
				var disclaimer_alpha=disclaimer_animation.alpha
				//print(current_find_context&&(current_find_context.m_flags&UI.SEARCH_FLAG_FUZZY?1.0:0.0),
				//	disclaimer_alpha,obj.disclaimer_transition_dt)
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
				var show_flag_buttons=(obj.show_find_bar!="goto")
				//fuzzy match disclaimer... fade, red search bar with "fuzzy match" written on
				var rect_bar=UI.RoundRect({
					x:obj.x+obj.find_bar_padding,y:obj.y+obj.find_bar_padding,
					w:w_obj_area-w_scrolling_area-obj.find_bar_padding*2-(obj.find_bar_button_size+obj.find_bar_padding)*(show_flag_buttons?4:1),h:obj.h_find_bar-obj.find_bar_padding*2,
					color:UI.lerp_rgba(obj.find_bar_color,obj.disclaimer_color,(disclaimer_alpha||0)*0.125),
					round:obj.find_bar_round})
				UI.DrawChar(UI.icon_font_20,obj.x+obj.find_bar_padding*2,obj.y+(obj.h_find_bar-UI.GetCharacterHeight(UI.icon_font_20))*0.5,
					obj.find_bar_hint_color,'s'.charCodeAt(0))
				var x_button_right=rect_bar.x+rect_bar.w+obj.find_bar_padding
				if(disclaimer_alpha>0){
					//"fuzzy search" text
					W.Text("",{x:8,
						anchor:rect_bar,anchor_align:'right',anchor_yalign:'up',
						font:obj.find_bar_hint_font,
						color:UI.lerp_rgba(obj.disclaimer_color&0x00ffffff,obj.disclaimer_color,disclaimer_alpha),
						text:"fuzzy search"})
				}
				if(show_flag_buttons){
					var btn_case=W.Button("find_button_case",{style:UI.default_styles.check_button,
						x:x_button_right,y:rect_bar.y+(rect_bar.h-obj.find_bar_button_size)*0.5,w:obj.find_bar_button_size,h:obj.find_bar_button_size,
						font:UI.icon_font,text:"写",tooltip:"Case sensitive - ALT+C",
						value:(UI.m_ui_metadata.find_state.m_find_flags&UI.SEARCH_FLAG_CASE_SENSITIVE?1:0),
						OnChange:function(value){
							UI.m_ui_metadata.find_state.m_find_flags=(UI.m_ui_metadata.find_state.m_find_flags&~UI.SEARCH_FLAG_CASE_SENSITIVE)|(value?UI.SEARCH_FLAG_CASE_SENSITIVE:0)
							obj.DestroyReplacingContext();
							obj.ResetFindingContext(obj.find_bar_edit.ed.GetText(),UI.m_ui_metadata.find_state.m_find_flags)
						}})
					W.Hotkey("",{key:"ALT+C",action:function(){btn_case.OnClick()}})
					x_button_right+=obj.find_bar_padding+obj.find_bar_button_size;
					var btn_word=W.Button("find_button_word",{style:UI.default_styles.check_button,
						x:x_button_right,y:rect_bar.y+(rect_bar.h-obj.find_bar_button_size)*0.5,w:obj.find_bar_button_size,h:obj.find_bar_button_size,
						font:UI.icon_font,text:"字",tooltip:"Whole word - ALT+H",
						value:(UI.m_ui_metadata.find_state.m_find_flags&UI.SEARCH_FLAG_WHOLE_WORD?1:0),
						OnChange:function(value){
							UI.m_ui_metadata.find_state.m_find_flags=(UI.m_ui_metadata.find_state.m_find_flags&~UI.SEARCH_FLAG_WHOLE_WORD)|(value?UI.SEARCH_FLAG_WHOLE_WORD:0)
							obj.DestroyReplacingContext();
							obj.ResetFindingContext(obj.find_bar_edit.ed.GetText(),UI.m_ui_metadata.find_state.m_find_flags)
						}})
					W.Hotkey("",{key:"ALT+H",action:function(){btn_word.OnClick()}})
					x_button_right+=obj.find_bar_padding+obj.find_bar_button_size;
					var btn_regexp=W.Button("find_button_regexp",{style:UI.default_styles.check_button,
						x:x_button_right,y:rect_bar.y+(rect_bar.h-obj.find_bar_button_size)*0.5,w:obj.find_bar_button_size,h:obj.find_bar_button_size,
						font:UI.icon_font,text:"正",tooltip:"Regular expression - ALT+E",
						value:(UI.m_ui_metadata.find_state.m_find_flags&UI.SEARCH_FLAG_REGEXP?1:0),
						OnChange:function(value){
							UI.m_ui_metadata.find_state.m_find_flags=(UI.m_ui_metadata.find_state.m_find_flags&~UI.SEARCH_FLAG_REGEXP)|(value?UI.SEARCH_FLAG_REGEXP:0)
							obj.DestroyReplacingContext();
							obj.ResetFindingContext(obj.find_bar_edit.ed.GetText(),UI.m_ui_metadata.find_state.m_find_flags)
						}})
					W.Hotkey("",{key:"ALT+E",action:function(){btn_regexp.OnClick()}})
					x_button_right+=obj.find_bar_padding+obj.find_bar_button_size;
				}
				W.Button("find_button_close",{style:UI.default_styles.check_button,
					x:x_button_right+2,y:rect_bar.y+(rect_bar.h-obj.find_bar_button_size)*0.5+2,w:obj.find_bar_button_size-4,h:obj.find_bar_button_size-4,
					font:UI.icon_font_20,text:"✕",tooltip:"Close - ESC",
					OnClick:function(){
						obj.find_bar_edit.CancelFind();
					}})
				var x_find_edit=obj.x+obj.find_bar_padding*3+UI.GetCharacterAdvance(UI.icon_font_20,'s'.charCodeAt(0));
				var w_find_edit=rect_bar.x+rect_bar.w-obj.find_bar_padding-x_find_edit;
				var previous_find_bar_edit=obj.find_bar_edit
				W.Edit("find_bar_edit",{
					language:doc.language,
					plugin_language_desc:doc.plugin_language_desc,
					style:obj.find_bar_editor_style,
					x:x_find_edit,w:w_find_edit,y:rect_bar.y,h:rect_bar.h,
					owner:obj,
					plugins:[ffindbar_plugin],
					CancelFind:function(){
						var obj=this.owner
						obj.show_find_bar=0;
						obj.doc.sel0.ccnt=obj.m_sel0_before_find
						obj.doc.sel1.ccnt=obj.m_sel1_before_find
						obj.doc.AutoScroll('center')
						obj.doc.scrolling_animation=undefined
						UI.Refresh()
					},
					OnBlur:function(nd_new){
						if(nd_new==doc){
							this.CancelFind();
						}
					},
				},W.CodeEditor_prototype);
				if(!previous_find_bar_edit){
					//the darn buttons do make sense in ctrl+g mode!
					var find_flag_mode=(obj.show_find_bar=="goto"?UI.SEARCH_FLAG_GOTO_MODE:0)
					if(UI.m_ui_metadata.find_state.m_current_needle||obj.show_find_bar=="goto"){
						if(UI.m_ui_metadata.find_state.m_current_needle&&obj.show_find_bar!="goto"){
							obj.find_bar_edit.HookedEdit([0,0,UI.m_ui_metadata.find_state.m_current_needle],1)
						}
						obj.find_bar_edit.sel0.ccnt=0
						obj.find_bar_edit.sel1.ccnt=obj.find_bar_edit.ed.GetTextSize()
						obj.ResetFindingContext(obj.find_bar_edit.ed.GetText(),UI.m_ui_metadata.find_state.m_find_flags|find_flag_mode)
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
						text:obj.show_find_bar=="goto"?"Function / class / line number":"Search"})
				}
			}
			//UI.RoundRect({
			//	x:obj.x+w_line_numbers-1, y:obj.y, w:1, h:h_obj_area,
			//	color:obj.separator_color})
			if(UI.HasFocus(doc)){
				var menu_edit=UI.BigMenu("&Edit")
				menu_edit.AddNormalItem({text:"&Undo",icon:"撤",enable_hotkey:0,key:"CTRL+Z",action:function(){
					doc.Undo()
				}})
				menu_edit.AddNormalItem({text:"&Redo",icon:"做",enable_hotkey:0,key:"SHIFT+CTRL+Z",action:function(){
					doc.Redo()
				}})
				///////////////////////
				menu_edit.AddSeparator()
				menu_edit.AddNormalItem({text:"Select &all",enable_hotkey:0,key:"CTRL+A",action:function(){
					doc.sel0.ccnt=0
					doc.sel1.ccnt=doc.ed.GetTextSize()
					doc.CallOnSelectionChange()
					UI.Refresh()
				}})
				if(doc.sel0.ccnt<doc.sel1.ccnt){
					menu_edit.AddNormalItem({text:"&Copy",icon:"拷",enable_hotkey:0,key:"CTRL+C",action:function(){
						doc.Copy()
					}})
				}
				menu_edit.AddNormalItem({text:"Cu&t",icon:"剪",enable_hotkey:0,key:"CTRL+X",action:function(){
					doc.Cut()
				}})
				if(UI.SDL_HasClipboardText()){
					menu_edit.AddNormalItem({text:"&Paste",enable_hotkey:0,key:"CTRL+V",action:function(){
						doc.Paste()
					}})
				}
				menu_edit.p_paste=menu_edit.$.length
				///////////////////////
				var acctx=obj.m_ac_context
				if(acctx&&acctx.m_n_cands){
					menu_edit.AddSeparator()
					if(acctx.m_n_cands==1||acctx.m_accands&&acctx.m_accands.m_common_prefix){
						menu_edit.AddNormalItem({text:"Auto-complete",enable_hotkey:1,key:"TAB",action:function(){
							acctx.Confirm(acctx.m_n_cands==1?0:undefined)
						}})
					}else if(!acctx.m_activated){
						menu_edit.AddNormalItem({text:"Auto-complete",enable_hotkey:1,key:"TAB",action:function(){
							acctx.Activate()
						}})
					}else{
						//the keys: left/right ,. -= 1234567890, enter / space / tab
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
							acctx.Confirm(acctx.m_selection)
						}
						menu_edit.AddButtonRow({text:"Auto-complete"},[
							{text:"<",tooltip:'- or ,',action:fprevpage},
							{key:"RETURN RETURN2",text:"confirm",tooltip:'ENTER or SPACE',action:fconfirm},
							{text:">",tooltip:'= or .',action:fnextpage}])
						W.Hotkey("",{text:",",action:fprevpage})
						W.Hotkey("",{text:".",action:fnextpage})
						W.Hotkey("",{text:"-",action:fprevpage})
						W.Hotkey("",{text:"=",action:fnextpage})
						W.Hotkey("",{key:"LEFT",action:fprevcand})
						W.Hotkey("",{key:"RIGHT",action:fnextcand})
						W.Hotkey("",{text:" ",action:fconfirm})
						W.Hotkey("",{key:"TAB",action:fconfirm})
					}
				}
				///////////////////////
				var menu_search=UI.BigMenu("&Search")
				var finvoke_find=function(){
					var sel=obj.doc.GetSelection()
					obj.show_find_bar="find"
					obj.m_sel0_before_find=obj.doc.sel0.ccnt
					obj.m_sel1_before_find=obj.doc.sel1.ccnt
					if(sel[0]<sel[1]){
						UI.m_ui_metadata.find_state.m_current_needle=obj.doc.ed.GetText(sel[0],sel[1]-sel[0])
						if(UI.m_ui_metadata.find_state.m_find_flags&UI.SEARCH_FLAG_REGEXP){
							UI.m_ui_metadata.find_state.m_current_needle=RegexpEscape(UI.m_ui_metadata.find_state.m_current_needle)
						}
					}
					obj.DismissNotification('find_result')
					UI.Refresh()
				};
				menu_search.AddNormalItem({text:"&Find or replace...",icon:"s",enable_hotkey:1,key:"CTRL+F",action:finvoke_find})
				W.Hotkey("",{text:"CTRL+R",action:finvoke_find})
				menu_search.AddButtonRow({text:"Find previous / next"},[
					{key:"SHIFT+F3",text:"find_up",icon:"上",tooltip:'Prev - SHIFT+F3',action:function(){
						obj.FindNext(-1)
					}},{key:"F3",text:"find_down",icon:"下",tooltip:'Next - F3',action:function(){
						obj.FindNext(1)
					}}])
				menu_search.AddButtonRow({text:"Find the current word"},[
					{key:"SHIFT+CTRL+F3",text:"word_up",icon:"上",tooltip:'Prev - SHIFT+CTRL+F3',action:function(){
						obj.BeforeQuickFind(-1);
						obj.FindNext(-1)
					}},{key:"CTRL+F3",text:"word_down",icon:"下",tooltip:'Next - CTRL+F3',action:function(){
						obj.BeforeQuickFind(1);
						obj.FindNext(1)
					}}])
				if(obj.m_replace_context){
					//menu_search.AddSeparator()
					//menu_search.AddButtonRow({text:"Replace"},[
					//	{key:"SHIFT+CTRL+D",text:"replace_up",icon:"上",tooltip:'Prev - SHIFT+CTRL+D',action:function(){
					//		obj.DoReplaceFromUI(-1)
					//	}},{key:"ALT+A",text:"replace_all",icon:"换",tooltip:'All - ALT+A',action:function(){
					//		obj.DoReplaceFromUI(0)
					//	}},{key:"CTRL+D",text:"replace_down",icon:"下",tooltip:'Next - CTRL+D',action:function(){
					//		obj.DoReplaceFromUI(1)
					//	}}])
					var ed_caret=doc.GetIMECaretXY();
					var y_caret=(ed_caret.y-doc.visible_scroll_y);
					var hc=UI.GetCharacterHeight(doc.font)
					UI.DrawPrevNextAllButtons(obj,obj.x+w_line_numbers,obj.y+y_caret+hc*0.5, menu_search,"Replace","Replace @1",
						function(){obj.DoReplaceFromUI(-1);},
						function(){obj.DoReplaceFromUI( 0);},
						function(){obj.DoReplaceFromUI( 1);})
				}
				menu_search.AddSeparator();
				menu_search.AddNormalItem({text:"&Go to...",enable_hotkey:1,key:"CTRL+G",action:function(){
					var sel=obj.doc.GetSelection()
					obj.show_find_bar="goto"
					obj.m_sel0_before_find=obj.doc.sel0.ccnt
					obj.m_sel1_before_find=obj.doc.sel1.ccnt
					//if(sel[0]<sel[1]){
					//	UI.m_ui_metadata.find_state.m_current_needle=obj.doc.ed.GetText(sel[0],sel[1]-sel[0])
					//}
					//UI.m_ui_metadata.find_state.m_current_needle=""
					UI.Refresh()
				}})
				if(doc.m_file_index&&doc.m_file_index.hasDecls()){
					menu_search.AddNormalItem({text:"Go to &definition",enable_hotkey:1,key:"F12",action:function(){
						var obj=this
						var doc=obj.doc
						var sel=doc.GetSelection();
						var ed=doc.ed
						var ccnt_sel1=doc.sel1.ccnt
						if(doc.m_diff_from_save){ccnt_sel1=doc.m_diff_from_save.CurrentToBase(ccnt_sel1)}
						var s_dep_file=UI.ED_QueryDepTokenByBaseCcnt(doc,ccnt_sel1)
						if(s_dep_file){
							UI.OpenEditorWindow(s_dep_file)
							return
						}
						sel[0]=ed.MoveToBoundary(sel[0],-1,"word_boundary_left")
						sel[1]=ed.MoveToBoundary(sel[1],1,"word_boundary_right")
						if(sel[0]<sel[1]){
							var id=ed.GetText(sel[0],sel[1]-sel[0])
							var ccnt0=doc.sel1.ccnt
							var ccnt=ccnt0
							for(;;){
								ccnt=doc.FindOuterLevel(ccnt);
								if(!(ccnt>=0)){ccnt=0;}
								if(doc.m_diff_from_save){
									ccnt=doc.m_diff_from_save.CurrentToBase(ccnt)
								}
								var ccnt_decl=UI.ED_QueryDecl(doc,ccnt,id)
								if(ccnt_decl>=0){
									if(doc.m_diff_from_save){
										ccnt_decl=doc.m_diff_from_save.BaseToCurrent(ccnt_decl)
									}
									if(ccnt_decl!=ccnt0){
										UI.SetSelectionEx(doc,ccnt_decl,ccnt_decl,"go_to_definition")
										UI.Refresh()
										return;
									}
								}
								if(!(ccnt>0)){break;}
							}
							var gkds=UI.ED_QueryKeyDeclByID(id)
							//not found, check key decls by id only
							var fn=doc.owner.file_name
							var p_target=0
							ccnt=ccnt0
							if(doc.m_diff_from_save){
								ccnt=doc.m_diff_from_save.CurrentToBase(ccnt)
							}
							for(var i=0;i<gkds.length;i+=2){
								if(fn==gkds[i+0]&&ccnt==gkds[i+1]){
									p_target=i+2
									break
								}
							}
							if(p_target<gkds.length){
								var ccnt_go=gkds[p_target+1]
								UI.RecordCursorHistroy(doc,"go_to_definition")
								UI.OpenEditorWindow(gkds[p_target+0],function(){
									var doc=this
									var ccnt=ccnt_go
									if(doc.m_diff_from_save){
										ccnt=doc.m_diff_from_save.BaseToCurrent(ccnt)
									}
									doc.SetSelection(ccnt,ccnt)
									UI.g_cursor_history_test_same_reason=1
									UI.Refresh()
								})
							}else{
								this.CreateNotification({id:'find_result',icon:'警',text:"Cannot find a definition"})
							}
						}
					}.bind(obj)})
				}
				doc.CallHooks('menu')
			}
		}
		if(UI.enable_timing){
			print('before minimap=',(Duktape.__ui_seconds_between_ticks(tick0,Duktape.__ui_get_tick())*1000).toFixed(2),'ms')
		}
		//minimap / scroll bar
		if(doc&&w_scrolling_area>0){
			var y_scrolling_area=obj.y
			var effective_scroll_y=doc.visible_scroll_y
			var sbar_value=Math.max(Math.min(effective_scroll_y/(ytot-h_scrolling_area),1),0)
			if(obj.show_minimap){
				var x_minimap=obj.x+w_obj_area-w_scrolling_area+obj.padding*0.5
				var minimap_scale=obj.minimap_font_height/UI.GetFontHeight(editor_style.font)
				var h_minimap=h_scrolling_area/minimap_scale
				var scroll_y_minimap=sbar_value*Math.max(ytot-h_minimap,0)
				UI.PushSubWindow(x_minimap,y_scrolling_area,obj.w_minimap,h_scrolling_area,minimap_scale)
					var renderer=doc.ed.GetHandlerByID(doc.ed.m_handler_registration["renderer"]);
					renderer.m_temporarily_disable_spell_check=1
					doc.ed.Render({x:0,y:scroll_y_minimap,w:obj.w_minimap/minimap_scale,h:h_minimap,
						scr_x:0,scr_y:0, scale:UI.pixels_per_unit, obj:doc});
					renderer.m_temporarily_disable_spell_check=0
				UI.PopSubWindow()
				var minimap_page_y0=(effective_scroll_y-scroll_y_minimap)*minimap_scale
				var minimap_page_y1=(effective_scroll_y+h_scrolling_area-scroll_y_minimap)*minimap_scale
				UI.RoundRect({
					x:x_minimap-obj.padding*0.5, y:y_scrolling_area+minimap_page_y0, w:obj.w_minimap+obj.padding, h:minimap_page_y1-minimap_page_y0,
					color:obj.minimap_page_shadow})
				UI.RoundRect({
					x:x_minimap-obj.padding*0.5, y:y_scrolling_area+minimap_page_y0, w:obj.w_minimap+obj.padding, h:obj.minimap_page_border_width,
					color:obj.minimap_page_border_color})
				UI.RoundRect({
					x:x_minimap-obj.padding*0.5, y:y_scrolling_area+minimap_page_y1-obj.minimap_page_border_width, w:obj.w_minimap+obj.padding, h:obj.minimap_page_border_width,
					color:obj.minimap_page_border_color})
				if((minimap_page_y1-minimap_page_y0)<h_minimap){
					W.Region('minimap_page',{
						x:x_minimap-obj.padding*0.5, y:y_scrolling_area+minimap_page_y0, w:obj.w_minimap+obj.padding, h:minimap_page_y1-minimap_page_y0,
						value:sbar_value,
						factor:h_scrolling_area-(minimap_page_y1-minimap_page_y0),
						OnChange:function(value){
							doc.scroll_y=value*(ytot-h_scrolling_area)
							doc.scrolling_animation=undefined
							UI.Refresh()
						},
					},W.MinimapThingy_prototype)
				}
			}
			//scrollbar background
			var sbar=UI.RoundRect({x:obj.x+w_obj_area-obj.w_scroll_bar, y:y_scrolling_area, w:obj.w_scroll_bar, h:h_scrolling_area,
				color:obj.line_number_bgcolor
			})
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
			//at-scrollbar bookmark marker
			var hc_bookmark=UI.GetCharacterHeight(obj.bookmark_font)
			if(bm_ccnts.length){
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
				UI.DrawChar(obj.sbar_eye_font,
					sbar.x+sbar.w-UI.MeasureText(obj.sbar_eye_font,"眼").w-1,
					sbar_page_y0-sbar.y>hc_bookmark?sbar_page_y0-hc_bookmark:sbar_page_y1,
					UI.lerp_rgba(obj.sbar_page_shadow&0xffffff,obj.sbar_page_shadow,opacity),"眼".charCodeAt(0))
				UI.RoundRect({
					x:sbar.x, y:sbar.y+sbar_page_y0, w:sbar.w, h:sbar_page_y1-sbar_page_y0,
					color:UI.lerp_rgba(obj.sbar_page_shadow&0xffffff,obj.sbar_page_shadow,opacity)})
				//UI.RoundRect({
				//	x:sbar.x, y:sbar.y+sbar_page_y0, w:sbar.w, h:obj.sbar_page_border_width,
				//	color:UI.lerp_rgba(obj.sbar_page_border_color&0xffffff,obj.sbar_page_border_color,opacity)})
				//UI.RoundRect({
				//	x:sbar.x, y:sbar.y+sbar_page_y1-obj.sbar_page_border_width, w:sbar.w, h:obj.sbar_page_border_width,
				//	color:UI.lerp_rgba(obj.sbar_page_border_color&0xffffff,obj.sbar_page_border_color,opacity)})
			}
			//separators
			UI.RoundRect({
				x:obj.x+w_obj_area-w_scrolling_area, y:y_scrolling_area, w:1, h:h_scrolling_area,
				color:obj.separator_color})
		}
		if(f_draw_accands){
			f_draw_accands()
		}
		if(UI.enable_timing){
			print('before notifications=',(Duktape.__ui_seconds_between_ticks(tick0,Duktape.__ui_get_tick())*1000).toFixed(2),'ms')
		}
		if(obj.m_notifications&&!obj.show_find_bar){
			W.ListView('notification_list',{x:obj.x+w_obj_area-w_scrolling_area-obj.w_notification-8,y:obj.y,w:obj.w_notification,h:h_obj_area-8,
				dimension:'y',layout_spacing:8,layout_align:'left',is_single_click_mode:1,no_region:1,no_clipping:1,
				item_template:{
					object_type:W.NotificationItem,
				},items:obj.m_notifications})
		}
		///////////////////////////////////////
		if(sxs_visualizer&&!obj.hide_sxs_visualizer){
			//it could just get parent as owner
			//separation shadow
			var w_shadow=obj.sxs_shadow_size
			if(sxs_area_dim=='x'){
				UI.RoundRect({
					x:x_sxs_area-w_shadow,y:y_sxs_area-w_shadow,w:w_shadow*2,h:h_sxs_area+w_shadow*2,
					color:obj.sxs_shadow_color,border_width:-w_shadow,round:w_shadow,
				})
			}else{
				UI.RoundRect({
					x:x_sxs_area-w_shadow,y:y_sxs_area-w_shadow,w:w_sxs_area+w_shadow*2,h:w_shadow*2,
					color:obj.sxs_shadow_color,border_width:-w_shadow,round:w_shadow,
				})
			}
			sxs_visualizer('sxs_visualizer',{x:x_sxs_area,y:y_sxs_area,w:w_sxs_area,h:h_sxs_area,owner:obj})
		}
	UI.End()
	if(UI.enable_timing){
		print('CodeEditor time=',(Duktape.__ui_seconds_between_ticks(tick0,Duktape.__ui_get_tick())*1000).toFixed(2),'ms')
	}
	return obj
}

var g_new_id=0
UI.NewCodeEditorTab=function(fname0){
	//var file_name=fname0||IO.GetNewDocumentName("new","txt","document")
	var file_name=fname0||("<New #"+(g_new_id++).toString()+">")
	DetectRepository(file_name)
	UI.top.app.quit_on_zero_tab=0;
	return UI.NewTab({
		file_name:file_name,
		title:UI.RemovePath(file_name),
		tooltip:file_name,
		opening_callbacks:[],
		body:function(){
			//use styling for editor themes
			UI.context_parent.body=this.main_widget;
			if(this.main_widget){this.file_name=this.main_widget.file_name}
			var body=W.CodeEditor("body",{
				'anchor':'parent','anchor_align':"fill",'anchor_valign':"fill",
				'x':0,'y':0,
				'file_name':this.file_name,
			})
			if(!this.main_widget){
				this.main_widget=body;
				body.m_is_brand_new=(!fname0&&this.auto_focus_file_search)
				if(this.opening_callbacks.length){
					if(body.m_finished_loading){
						var cbs=this.opening_callbacks
						if(cbs){
							for(var i=0;i<cbs.length;i++){
								cbs[i].call(body.doc);
							}
						}
					}else{
						body.opening_callbacks=this.opening_callbacks
					}
					this.opening_callbacks=[]
				}
			}
			var doc=body.doc;
			if(body.m_is_brand_new){
				body.title="New Tab"
				body.tooltip=undefined
			}else{
				body.title=UI.RemovePath(body.file_name)
				body.tooltip=body.file_name
			}
			this.need_save=0
			if(doc&&(doc.saved_point||0)!=doc.ed.GetUndoQueueLength()){
				body.title=body.title+'*'
				this.need_save=1
			}
			if(this.auto_focus_file_search&&body.sxs_visualizer&&body.sxs_visualizer.find_bar_edit){
				this.auto_focus_file_search=0
				UI.SetFocus(body.sxs_visualizer.find_bar_edit)
				body.sxs_visualizer.find_bar_edit.m_close_on_esc=1
				UI.Refresh()
			}
			/////////////////
			var menu_features=undefined
			var plugins=UI.m_editor_plugins
			for(var i=0;i<plugins.length;i++){
				var f=plugins[i]
				if(f.prototype&&f.prototype.name){
					//if(!menu_features){menu_features=UI.BigMenu("Fea&tures");}
					//todo: menu_features.
				}
			}
			return body;
		},
		Save:function(){
			if(!this.main_widget){return;}
			if(this.main_widget.file_name&&this.main_widget.file_name.indexOf('<')>=0){
				this.SaveAs()
				return
			}
			this.main_widget.Save();
			var doc=this.main_widget.doc;
			this.need_save=0
			if((doc.saved_point||0)<doc.ed.GetUndoQueueLength()){
				this.need_save=1
			}
		},
		SaveAs:function(){
			if(!this.main_widget){return;}
			var fn=IO.DoFileDialog(["All File","*.*"],
				this.main_widget.file_name.indexOf('<')>=0?
					UI.m_new_document_search_path+"/*":
					this.main_widget.file_name,
				"",1);
			if(!fn){return;}
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
		property_windows:[],
		color_theme:[UI.Platform.BUILD=="debug"?0xff1f1fb4:0xffb4771f],
	})
};

UI.RegisterLoaderForExtension("*",function(fname){return UI.NewCodeEditorTab(fname)})

UI.OpenEditorWindow=function(fname,fcallback){
	if(UI.Platform.ARCH=="win32"||UI.Platform.ARCH=="win64"){
		fname=fname.toLowerCase()
	}
	var obj_tab=undefined;
	for(var i=0;i<UI.g_all_document_windows.length;i++){
		if(UI.g_all_document_windows[i].file_name==fname){
			obj_tab=UI.g_all_document_windows[i]
			UI.top.app.document_area.SetTab(i)
			break
		}
	}
	if(!obj_tab){
		obj_tab=UI.NewCodeEditorTab(fname)
	}
	if(fcallback){
		if(obj_tab.main_widget){
			fcallback.call(obj_tab.main_widget.doc)
		}else{
			obj_tab.opening_callbacks.push(fcallback)
		}
	}
}

UI.OnApplicationSwitch=function(){
	for(var i=0;i<UI.g_all_document_windows.length;i++){
		var obj_tab=UI.g_all_document_windows[i]
		if(obj_tab.main_widget&&obj_tab.main_widget.doc){
			var obj=obj_tab.main_widget
			if(obj.doc.m_loaded_time!=IO.GetFileTimestamp(obj.file_name)){
				if(obj.doc.ed.saving_context){continue;}//saving docs are OK
				//reload
				if(!IO.FileExists(obj.file_name)){
					//make a notification
					obj.CreateNotification({id:'saving_progress',icon:'警',text:"IT'S DELETED!\nSave your changes to dismiss this"})
					obj.doc.saved_point=-1;
				}else if(obj_tab.need_save){
					//make a notification
					obj.CreateNotification({id:'saving_progress',icon:'警',text:"FILE CHANGED OUTSIDE!\n - Use File-Revert to reload\n - Save your changes to dismiss this"})
					obj.doc.saved_point=-1;
				}else{
					//what is reload? nuke it
					obj.Reload()
				}
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
	UI.g_cursor_history_undo.push({file_name:doc.owner.file_name,ccnt0:prev_ccnt0,ccnt1:prev_ccnt1,sreason:sreason})
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

//UI.enable_timing=1
