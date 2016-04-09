var UI=require("gui2d/ui");
var W=require("gui2d/widgets");
UI.RICHTEXT_COMMAND_RUBBER_SPACE=0x107fff;
UI.RICHTEXT_COMMAND_SET_STYLE=0x108000;

///////////////////////
UI.interpolators["tabid"]=function(a,b,t){return b;}
W.TabLabel_prototype={
	title:"",//initial empty title
	mouse_state:'out',
	OnMouseOver:function(){this.mouse_state="over";UI.Refresh();},
	OnMouseOut:function(){this.mouse_state="out";UI.Refresh();},
	GetSubStyle:function(){
		return this.mouse_state
	},
	OnMouseDown:function(event){
		if(this.tabid==undefined){return;}
		if(event.clicks!=2){
			UI.CaptureMouse(this);
			this.owner.OnTabDown(this.tabid,event,this.x,this.y)
		}
	},
	OnMouseMove:function(event){
		if(this.tabid==undefined){return;}
		this.owner.OnTabMove(this.tabid,event)
	},
	OnMouseUp:function(event){
		if(this.tabid==undefined){return;}
		this.owner.OnTabMove(this.tabid,event)
		if(event.clicks==2){
			this.owner.CancelTabDragging();
		}else{
			this.owner.OnTabUp(this.tabid)
			this.tabid=undefined;
		}
		UI.ReleaseMouse(this);
		UI.Refresh()
	},
	OnClick:function(event){
		if(event.button==UI.SDL_BUTTON_RIGHT){
			this.OnRightClick(event);
			//return;
			event.clicks=1;
		}else{
			this.owner.m_menu_context=undefined;
			UI.Refresh();
		}
		if(event.clicks>=2&&this.tabid!=undefined){
			this.owner.ArrangeTabs(this.tabid)
		}
	},
	OnRightClick:function(event){
		if(this.owner.m_menu_context){
			this.owner.m_menu_context.x=event.x;
			this.owner.m_menu_context.y=event.y;
			UI.Refresh()
			return
		}
		var menu_context=UI.CreateContextMenu("tab_menu_group");
		if(!menu_context){return;}
		this.owner.m_menu_context={x:event.x,y:event.y,menu:menu_context};
		menu_context=undefined;
	},
}
W.TabLabel=function(id,attrs){
	var obj=UI.Keep(id,attrs,W.TabLabel_prototype);
	UI.StdStyling(id,obj,attrs, "tab_label",obj.selected>0?obj.selected==2?"active":"rendered":"inactive");
	//if(!attrs.w){
	//	obj.text=obj.title;
	//	obj.w=UI.MeasureIconText(obj).w;
	//}
	//obj.x+=obj.x_animated
	if(attrs.x==undefined){
		obj.x=obj.x_animated;
	}
	UI.StdAnchoring(id,obj);
	W.PureRegion(id,obj)
	UI.Begin(obj)
		if(obj.selected>0){
			UI.RoundRect({
				x:obj.x,y:obj.y-obj.shadow_size*0.5,w:obj.w+obj.shadow_size,h:obj.h+obj.shadow_size*1.5,
				color:obj.shadow_color,border_width:-obj.shadow_size,round:obj.shadow_size,
			})
			UI.RoundRect({
				x:obj.x,y:obj.y,w:obj.w,h:obj.h,
				color:obj.color,
			})
		}
		if(obj.hotkey_str){
			var dims=UI.MeasureText(obj.hotkey_font,obj.hotkey_str)
			W.Text("",{
				'anchor':'parent','anchor_align':"left",'anchor_valign':"up",
				'x':12-dims.w,'y':6,
				'font':obj.hotkey_font,'text':obj.hotkey_str,
				'color':UI.lerp_rgba(obj.text_color&0xffffff,obj.text_color,0.5),
			})
		}
		W.Text("",{
			'anchor':'parent','anchor_align':"left",'anchor_valign':"center",
			'x':14,'y':0,
			'font':obj.font,'text':obj.title,'color':obj.text_color,
		})
		if(obj.mouse_state=="over"||obj.close_button&&(obj.close_button.mouse_state||"out")!="out"){
			if(obj.tooltip){W.DrawTooltip(obj);}
			W.Button("close_button",{
				style:obj.button_style,
				text:"✕",
				x:4,y:12,
				text_color:obj.text_color&0x7fffffff,
				'anchor':'parent','anchor_align':"right",'anchor_valign':"up",
				OnClick:function(){
					this.owner.CloseTab(this.tabid)
				}.bind(obj),
			});
		}
	UI.End()
	return obj
}

UI.MAX_TAB_SWITCH_COUNT=32
UI.IncrementTabSwitchCount=function(counts,fn,delta0){
	var n_tot=(counts["$"]||0)
	var delta=Math.max(delta0,n_tot*delta0/UI.MAX_TAB_SWITCH_COUNT|0)
	n_tot+=delta
	counts["$"]=n_tot;
	var n=(counts[fn]||0)
	counts[fn]=n+delta;
	if(n_tot>UI.MAX_TAB_SWITCH_COUNT*1024){
		n_tot=0
		for(var key in counts){
			if(key=="$"){continue;}
			counts[key]=Math.max((counts[key]/1024)|0,1);
			n_tot+=counts[key];
		}
		counts["$"]=n_tot;
	}
}

UI.m_closed_windows=[];
var GetTabFileName=function(tab1){
	var fn=tab1.file_name
	if(tab1.main_widget&&tab1.main_widget.file_name){fn=tab1.main_widget.file_name}
	return fn;
}
var segDist=function(x0,x1,x){
	return x<x0?x0-x:Math.max(x-x1,0);
};
var dfsFindLayoutByName=function(layout,name){
	if(layout.children){
		var ret=undefined;
		for(var i=0;i<layout.children.length;i++){
			ret=dfsFindLayoutByName(layout.children[i],name);
			if(ret){break;}
		}
		return ret;
	}
	return layout.name==name?layout:undefined;
};
W.TabbedDocument_prototype={
	//closer -> class: OnClose notification and stuff
	CloseTab:function(tabid,forced){
		if(tabid==undefined){tabid=this.current_tab_id}
		if(tabid==undefined){return;}
		var tab=this.items[tabid]
		if(!tab){return;}
		if(tab.need_save&&!forced){
			//this doesn't count as a meaningful switch
			this.current_tab_id=tabid
			//dialog box
			tab.in_save_dialog=1
			UI.Refresh()
			return;
		}
		///////
		var fntab=GetTabFileName(tab);
		if(fntab){
			UI.m_closed_windows=UI.m_closed_windows.filter(UI.HackCallback(function(fn){return fn!=fntab}))
			UI.m_closed_windows.push(fntab);
		}
		//close it
		if(!tab.need_save){
			tab.SaveMetaData();
			UI.SaveMetaData();
		}
		var window_list=this.items
		var n2=tabid;
		for(var i=tabid+1;i<window_list.length;i++){
			window_list[n2]=window_list[i]
			this[n2]=this[i];
			n2++;
			window_list[n2].__global_tab_id=n2;
		}
		this[window_list.length-1]=undefined;
		window_list.pop()
		if(this.just_created_a_tab||((window_list[this.current_tab_id]||{}).area_name||"doc_default")!=(tab.area_name||"doc_default")){
			//just closed or about to go to the next region, go to previous tab
			if(this.current_tab_id>=tabid){this.current_tab_id--}
		}else{
			//switched, go to next tab
			if(this.current_tab_id>tabid){this.current_tab_id--}
		}
		this.just_created_a_tab=0;
		if(this.current_tab_id>=this.items.length){this.current_tab_id--}
		//this doesn't count as a meaningful switch
		if(this.current_tab_id<0){this.current_tab_id=0;}
		if(tab.OnDestroy){tab.OnDestroy()}
		this.CancelTabDragging();
		if(!this.m_is_close_pending){
			UI.SaveWorkspace();
		}
		UI.Refresh()
		UI.CallGCLater()
		//if(UI.Platform.BUILD=="debug"){
		//	print(">>> window closed");
		//	Duktape.gc();
		//	UI.dumpMemoryUsage();
		//}
	},
	CloseAll:function(but_this){
		var tab=this.items[this.current_tab_id];
		var type='file';
		if(tab.util_type){
			type='util';
		}
		for(;;){
			var did=0;
			for(var i=0;i<this.items.length;i++){
				var tab_i=this.items[i];
				if(but_this&&tab_i==tab){
					continue;
				}
				if(tab_i.util_type&&type=='file'){continue;}
				if(!tab_i.util_type&&type=='util'){continue;}
				if(tab_i.in_save_dialog){continue;}
				this.CloseTab(i);
				did=1;
				break;
			}
			if(!did){break;}
		}
		UI.Refresh();
	},
	//bring up a tab *without* focusing it
	BringUpTab:function(tabid){
		var tab0=this.items[tabid];
		tab0.z_order=UI.g_current_z_value;
		UI.g_current_z_value++;
		UI.Refresh()
	},
	SetTab:function(tabid){
		var tabid0=this.current_tab_id
		if(tabid0!=undefined){
			var tab0=this.items[tabid0]
			var tab1=this.items[tabid]
			if(tab0&&tab1){
				if(tab0.main_widget&&tab0.main_widget.m_tabswitch_count&&tab1.file_name){
					var fn=GetTabFileName(tab1);
					var counts=tab0.main_widget.m_tabswitch_count
					UI.IncrementTabSwitchCount(counts,fn,1)
				}
			}
		}
		if(this.current_tab_id!=tabid){
			//for close hack
			this.just_created_a_tab=0;
			//for focus sync
			UI.SetFocus(undefined)
		}
		this.current_tab_id=tabid
		UI.Refresh()
	},
	SaveTab:function(tabid){
		var active_document=this.items[tabid];
		if(!active_document||!active_document.Save){return 0;}
		active_document.Save()
		return !active_document.need_save
	},
	SaveCurrent:function(){
		var active_document=this.active_tab;
		if(!active_document||!active_document.Save){return 0;}
		active_document.Save()
		return !active_document.need_save
	},
	SaveAs:function(){
		var active_document=this.active_tab;
		if(!active_document||!active_document.SaveAs){return 0;}
		active_document.SaveAs()
		return !active_document.need_save
	},
	SaveAll:function(){
		var ret=1
		for(var i=0;i<this.items.length;i++){
			var tab_i=this.items[i]
			if(tab_i.need_save){
				tab_i.Save()
			}
			if(tab_i.need_save){ret=0}
		}
		return ret
	},
	OnClose:function(){
		var ret=0
		for(var i=0;i<this.items.length;i++){
			var tab_i=this.items[i]
			if(tab_i.need_save){
				if(ret==0){
					//this doesn't count as a meaningful switch
					this.just_created_a_tab=0;
					this.current_tab_id=i;
					UI.SetFocus(undefined)
					tab_i.in_save_dialog=1
				}
				ret=1
			}//else{
			tab_i.SaveMetaData()
			//}
		}
		if(ret==0){
			if(!this.m_is_close_pending){
				UI.SaveWorkspace();
			}
		}else{
			this.m_is_close_pending=1
			UI.Refresh()
			return ret;
		}
		var window_list=this.items
		var n2=0;
		for(var i=0;i<window_list.length;i++){
			var tab_i=window_list[i]
			if(tab_i.need_save){
				window_list[n2]=tab_i;
				this[n2]=this[i];
				n2++;
			}else{
				if(this.current_tab_id>i){this.current_tab_id--}
			}
		}
		while(window_list.length>n2){
			this[window_list.length-1]=undefined;
			window_list.pop();
		}
		//this doesn't count as a meaningful switch
		if(this.current_tab_id>=this.items.length){this.current_tab_id--}
		if(this.current_tab_id<0){this.current_tab_id=0;}
		UI.SaveMetaData()
		UI.Refresh()
		this.just_created_a_tab=0;
		this.m_is_close_pending=1
		return ret
	},
	SetMenuState:function(value){
		if(this.m_is_in_menu==value){return;}
		this.m_is_in_menu=value;
		if(this.m_is_in_menu){
			//g_menu_action_invoked=0;
			UI.m_frozen_global_menu=UI.m_global_menu
			//UI.m_frozen_global_menu.bk_tabbar_scroll_x=this.scroll_x
			UI.m_frozen_global_menu.bk_focus=UI.nd_focus;
		}else{
			if(UI.m_frozen_global_menu){
				//this.scroll_x=UI.m_frozen_global_menu.bk_tabbar_scroll_x;
				UI.SetFocus(UI.m_frozen_global_menu.bk_focus)
			}
			UI.m_frozen_global_menu=undefined;
		}
		UI.Refresh()
	},
	OnMenu:function(){
		this.SetMenuState(!this.m_is_in_menu);
		UI.Refresh()
	},
	OnWindowBlur:function(){
		this.SetMenuState(0);
		UI.Refresh()
	},
	////////////
	OnTabDown:function(tabid,event,x_label,y_label){
		if(event.button==UI.SDL_BUTTON_MIDDLE){
			this.CloseTab(tabid)
			return;
		}else{
			this.SetTab(tabid)
		}
		var layout=UI.m_ui_metadata["<layout>"];
		//create a current tab label x snapshot
		this.m_dragging_caption_areas=this.m_caption_areas;
		this.m_dragging_tab_moved=0
		this.m_dragging_tab_x_offset=event.x-x_label;
		this.m_dragging_tab_y_offset=event.y-y_label;
		this.m_dragging_tab_src_tabid=tabid
		this.m_dragging_tab_target=undefined;
		this.m_dragging_mouse_moved=0;
		this.m_dragging_mouse_x=event.x;
		this.m_dragging_mouse_y=event.y;
		/////////////
		var caption_areas=this.m_dragging_caption_areas;
		for(var i=0;i<caption_areas.length;i++){
			var area_i=caption_areas[i];
			for(var j=0;j<area_i.tabs.length;j++){
				var tabid_j=area_i.tabs[j];
				if(tabid_j==tabid){
					area_i.has_dragging_src=1;
				}
			}
		}
	},
	OnTabMove:function(tabid,event){
		var caption_areas=this.m_dragging_caption_areas;
		if(caption_areas==undefined){return;}
		if(!this.m_dragging_mouse_moved&&Math.abs(this.m_dragging_mouse_x-event.x)<4&&Math.abs(this.m_dragging_mouse_y-event.y)<4){
			//prevent auto-scroll false drag
			return;
		}
		var target_position=undefined;
		this.m_dragging_mouse_moved=1;
		this.m_dragging_mouse_x=event.x;
		this.m_dragging_mouse_y=event.y;
		var layout=UI.m_ui_metadata["<layout>"];
		for(var i=0;i<caption_areas.length;i++){
			var area_i=caption_areas[i];
			var scroll_x=(UI.g_caption_scroll_by_name[area_i.name]||0);
			if(segDist(area_i.y,area_i.y+area_i.h,event.y)<this.caption_drag_tolerance_y){
				for(var j=0;j<area_i.tabs.length;j++){
					var tabid_j=area_i.tabs[j];
					var x0_j=area_i.x0_w_tabs[j*2]-scroll_x;
					var x1_j=x0_j+area_i.x0_w_tabs[j*2+1];
					x0_j=Math.max(x0_j,area_i.x);
					x1_j=Math.min(x1_j,area_i.x+area_i.w);
					var dist=segDist(x0_j,j==area_i.tabs.length-1?area_i.x+area_i.w:x1_j,event.x);
					//dist<this.caption_drag_tolerance_x
					if(target_position==undefined||target_position.score>dist){
						//source area / other area
						var side=0;
						if(area_i.has_dragging_src){
							side=(tabid_j<=this.m_dragging_tab_src_tabid?0:1);
						}else{
							side=(event.x<(x0_j+x1_j)*0.5?0:1);
						}
						if(side==0){
							target_position={
								score:dist,name:area_i.name,area_id:i,tabid:tabid_j,
							}
						}else{
							target_position={
								score:dist,name:area_i.name,area_id:i,tabid:tabid_j+1,
							}
						}
					}
				}
			}
			//window splitting check - cross-split
			var box=area_i.content_box;
			if(box.w>0&&box.h>0&&!layout.m_is_maximized&&!(area_i.has_dragging_src&&area_i.tabs.length==1)){
				var dist=segDist(box.x,box.x+box.w,event.x)+segDist(box.y,box.y+box.h,event.y)+this.split_penalty;
				if(target_position==undefined||target_position.score>dist){
					//source area / other area
					var fx=(event.x-box.x)/box.w;
					var fy=(event.y-box.y)/box.h;
					var side=undefined;
					if(fx<fy){
						if(fx<1-fy){
							side="left";
						}else{
							side="down";
						}
					}else{
						if(fx<1-fy){
							side="up";
						}else{
							side="right";
						}
					}
					target_position={
						score:dist,name:area_i.name,area_id:i,
						split_side:side,
					}
				}
			}
		}
		if(target_position&&target_position.tabid==this.m_dragging_tab_src_tabid){
			target_position=undefined;
		}
		if(target_position){
			this.m_dragging_tab_moved=1;
		}
		this.m_dragging_tab_target=target_position;
		//create caption rendering context
		//active tab, tar-area after, src-area after potential split shade
		var tab_label_style=UI.default_styles.tab_label;
		var rendering_caption_areas=[];
		var tar_added=0;
		for(var i=0;i<caption_areas.length;i++){
			var area_i=caption_areas[i];
			var x_caption=area_i.x;
			var out_area_i={};out_area_i.__proto__=area_i;
			out_area_i.x0_w_tabs=[];
			for(var j=0;j<area_i.tabs.length;j++){
				var tabid_j=area_i.tabs[j];
				if(target_position&&tabid_j==this.m_dragging_tab_src_tabid){
					out_area_i.x0_w_tabs[j*2]=undefined;
					out_area_i.x0_w_tabs[j*2+1]=undefined;
					continue
				}else if(target_position&&!tar_added&&i==target_position.area_id&&target_position.tabid!=undefined&&tabid_j>=target_position.tabid){
					//add target
					var w_src_at_target=UI.MeasureText(tab_label_style.font,this.items[this.m_dragging_tab_src_tabid].title).w+tab_label_style.padding*2;
					x_caption+=w_src_at_target;
					tar_added=1;
				}
				var w_j=UI.MeasureText(tab_label_style.font,this.items[tabid_j].title).w+tab_label_style.padding*2;
				out_area_i.x0_w_tabs[j*2]=x_caption;
				out_area_i.x0_w_tabs[j*2+1]=w_j;
				x_caption+=w_j;
			}
			rendering_caption_areas[i]=out_area_i;
		}
		this.m_dragging_rendering_caption_areas=rendering_caption_areas;
		UI.Refresh()
	},
	OnTabUp:function(tabid){
		if(this.m_dragging_caption_areas==undefined){return;}
		this.m_dragging_caption_areas=undefined;
		this.m_dragging_rendering_caption_areas=undefined;
		if(!this.m_dragging_tab_moved||!this.m_dragging_tab_target){
			//this.SetTab(tabid)
		}else{
			//get old names, generate new once
			var target_position=this.m_dragging_tab_target;
			if(target_position.split_side){
				//actually split, shuffle the object
				var layout=UI.m_ui_metadata["<layout>"];
				var target_layout=dfsFindLayoutByName(layout,target_position.name)
				if(target_layout){
					var type0=target_layout.type;
					var name0=target_layout.name;
					if(layout.g_new_layout_id==undefined){layout.g_new_layout_id=0;}
					var name_new=undefined;
					var tab0=this.items[this.m_dragging_tab_src_tabid];
					for(;;){
						name_new="doc_"+layout.g_new_layout_id.toString();
						layout.g_new_layout_id++;
						if(!dfsFindLayoutByName(layout,name_new)){break;}
					}
					var name_src=tab0.area_name;
					if(name_src&&!(name_src.length>=4&&name_src.substr(0,4)=='doc_')){
						var n_src=0;
						for(var i=0;i<this.items.length;i++){
							if(this.items[i].area_name==name_src){
								n_src++;
							}
						}
						if(n_src<=1){
							//swap name - drag util into something, keep the area name
							var nd_src=dfsFindLayoutByName(layout,name_src)
							nd_src.name=name_new;
							var tmp=name_new;
							name_new=name_src;
							name_src=tmp;
						}
					}
					target_layout.name=undefined;
					if(target_position.split_side=="up"){
						target_layout.type="vsplit";
						target_layout.children=[{type:type0,name:name_new},{type:type0,name:name0}];
					}else if(target_position.split_side=="down"){
						target_layout.type="vsplit";
						target_layout.children=[{type:type0,name:name0},{type:type0,name:name_new}];
					}else if(target_position.split_side=="left"){
						target_layout.type="hsplit";
						target_layout.children=[{type:type0,name:name_new},{type:type0,name:name0}];
					}else{ UI.assert(target_position.split_side=="right");
						target_layout.type="hsplit";
						target_layout.children=[{type:type0,name:name0},{type:type0,name:name_new}];
					}
					target_layout.split=0.5;
					tab0.area_name=name_new;
				}
			}else{
				//put src tab at target_position.tabid
				var tab0=this.items[this.m_dragging_tab_src_tabid]
				var bk_widgets=[];
				var new_items=[];
				for(var i=0;i<this.items.length;i++){
					bk_widgets[i]=this[i];
					this.items[i].__global_tab_id=i;
					this[i]=undefined;
				}
				for(var i=0;i<this.items.length;i++){
					if(i==target_position.tabid){
						new_items.push(tab0);
					}
					if(i==this.m_dragging_tab_src_tabid){continue;}
					new_items.push(this.items[i]);
				}
				if(this.items.length==target_position.tabid){
					new_items.push(tab0);
				}
				///////////////
				for(var i=0;i<this.items.length;i++){
					this.items[i]=new_items[i];
				}
				for(var i=0;i<this.items.length;i++){
					this[i]=bk_widgets[this.items[i].__global_tab_id];
					this.items[i].__global_tab_id=i;
					if(this.items[i]==tab0){
						this.current_tab_id=i;
					}
				}
				tab0.area_name=target_position.name;
			}
			this.just_created_a_tab=0;
			UI.Refresh()
		}
	},
	CancelTabDragging:function(){
		if(this.m_dragging_caption_areas!=undefined){
			this.m_dragging_caption_areas=undefined
			if(UI.nd_captured){UI.ReleaseMouse(UI.nd_captured)}
		}
	},
	MoveToFront:function(tabid_tar,tabid){
		if(!(tabid>tabid_tar+1)){return;}
		var bk_ui_item=[];
		for(var i=0;i<this.items.length;i++){
			var item_i=this.items[i];
			item_i.m_id_original=i;
			bk_ui_item[i]=this[i];
		}
		var tab_in_question=this.items[tabid];
		for(var i=tabid;i>tabid_tar+1;i--){
			this.items[i]=this.items[i-1];
		}
		this.items[tabid_tar+1]=tab_in_question;
		//reshuffle UI items
		for(var i=0;i<this.items.length;i++){
			var item_i=this.items[i];
			this[i]=bk_ui_item[item_i.m_id_original];
			item_i.m_id_original=undefined;
			item_i.__global_tab_id=i;
		}
		this.just_created_a_tab=1;
		this.SetTab(tabid_tar+1);
		UI.Refresh()
	},
	ArrangeTabs:function(tabid){
		if(tabid==undefined){tabid=this.current_tab_id;}
		if(!(tabid>=0&&tabid<this.items.length)){return;}
		var sname0=GetTabFileName(this.items[tabid]);
		var bk_ui_item=[];
		for(var i=0;i<this.items.length;i++){
			var item_i=this.items[i];
			var sname_i=GetTabFileName(item_i);
			item_i.m_id_original=i;
			item_i.m_arrangement_score=Duktape.__commonPrefixLength(sname0,sname_i);
			if(i==tabid){item_i.m_arrangement_score=1e15;}
			bk_ui_item[i]=this[i];
		}
		this.items.sort(function(a,b){return b.m_arrangement_score-a.m_arrangement_score||a.m_id_original-b.m_id_original})
		//reshuffle UI items
		for(var i=0;i<this.items.length;i++){
			var item_i=this.items[i];
			this[i]=bk_ui_item[item_i.m_id_original];
			item_i.m_id_original=undefined;
			item_i.m_arrangement_score=undefined;
		}
		this.just_created_a_tab=0;
		this.current_tab_id=0;
		UI.Refresh()
	},
	ToggleMaximizeMode:function(){
		if(this.m_dragging_caption_areas){return;}
		var layout=UI.m_ui_metadata["<layout>"];
		layout.m_is_maximized=!layout.m_is_maximized;
		UI.Refresh();
	},
}
var g_sizing_rect_prototype={
	OnMouseDown:function(event){
		UI.CaptureMouse(this);
		this.m_is_dragging=1;
		this.m_dragging_x=event.x;
		this.m_dragging_y=event.y;
		this.m_dragging_split0=this.nd.split;
	},
	OnMouseMove:function(event){
		if(!this.m_is_dragging){return;}
		var nd=this.nd;
		var dsplit=0;
		if(nd.type=="hsplit"){
			dsplit=(event.x-this.m_dragging_x)/this.area_size.w;
		}else{
			dsplit=(event.y-this.m_dragging_y)/this.area_size.h;
		}
		nd.split=Math.min(Math.max(this.m_dragging_split0+dsplit,0.05),0.95);
		UI.Refresh()
	},
	OnMouseUp:function(event){
		this.m_is_dragging=0;
		this.OnMouseMove(event)
		UI.ReleaseMouse(this);
	},
};
var g_rerender_events=["OnMouseOver","OnMouseOut","OnMouseMove","OnMouseDown","OnMouseUp","OnMouseWheel","OnClick","OnDblClick","OnFocus","OnBlur","OnTextInput","OnTextEdit","OnKeyDown","OnKeyUp"];
var RenderLayout=function(layout,obj,y_base){
	//per-tab z_order, sort and reset on workspace save / restore
	var has_area_name={};
	var windows_to_render={};
	var items=obj.items;
	if(obj.active_tab){
		if(obj.active_tab.z_order!=UI.g_current_z_value-1){
			obj.active_tab.z_order=UI.g_current_z_value;
			UI.g_current_z_value++;
		}
	}
	//print("---")
	for(var i=0;i<items.length;i++){
		var area_name=(items[i].area_name||"doc_default");
		var z_i=(items[i].z_order||0);
		//print(items[i].title,z_i)
		if(items[i].UpdateTitle){
			items[i].UpdateTitle();
		}
		if(!windows_to_render[area_name]||windows_to_render[area_name].z_order<=z_i){
			windows_to_render[area_name]=items[i];
		}
	}
	//dfs layout - is-there test
	var active_name=(obj.active_tab&&obj.active_tab.area_name||"doc_default");
	var dfsIsThere=function(nd){
		var is_there=0;
		var has_active=0;
		var z_order=0;
		if(nd.type=="hsplit"||nd.type=="vsplit"){
			for(var i=0;i<nd.children.length;i++){
				is_there=Math.max(is_there,dfsIsThere(nd.children[i]));
				has_active|=nd.children[i].temp_has_active;
				z_order=Math.max(z_order,nd.children[i].temp_z_order)
			}
		}else{
			has_area_name[nd.name]=1;
			is_there=(windows_to_render[nd.name]?2:0);
			z_order=(windows_to_render[nd.name]&&windows_to_render[nd.name].z_order||0);
			if(!is_there&&nd.name=="doc_default"){
				is_there=2;
			}
			if(!is_there&&!(nd.name.length>=4&&nd.name.substr(0,4)=='doc_')){
				//don't auto-delete, don't render either
				is_there=1;
			}
			if(nd.name==active_name){
				has_active=1;
			}
		}
		nd.temp_is_there=is_there;
		nd.temp_has_active=has_active;
		nd.temp_z_order=z_order;
		return is_there;
	};
	UI.HackCallback(dfsIsThere)
	dfsIsThere(layout)
	for(var i=0;i<items.length;i++){
		var area_name=(items[i].area_name||"doc_default");
		if(!has_area_name[area_name]){
			items[i].area_name=undefined;
			UI.Refresh();
		}
	}
	//auto-delete unused doc layouts
	if(UI.g_app_inited){
		var dfsCleanUp=function(nd){
			if(nd.type=="hsplit"||nd.type=="vsplit"){
				var ch0=nd.children[0];
				var ch1=nd.children[1];
				if(ch0.temp_is_there&&ch1.temp_is_there){
					nd.children[0]=dfsCleanUp(ch0);
					nd.children[1]=dfsCleanUp(ch1);
				}else{
					return dfsCleanUp(ch0.temp_is_there?ch0:ch1);
				}
			}
			return nd;
		};
		UI.HackCallback(dfsCleanUp);
		layout=dfsCleanUp(layout);
		UI.m_ui_metadata["<layout>"]=layout;
	}
	var rendered_areas=[];
	//coulddo: animated area sizes for ESC maximize
	var id_sizing_rect=0;
	var all_shadows=[];
	var enable_smart_tab_repainting=UI.TestOption("enable_smart_tab_repainting");
	var dfsRender=function(nd,x,y,w,h){
		if(nd.type=="hsplit"||nd.type=="vsplit"){
			var ch0=nd.children[0];
			var ch1=nd.children[1];
			if(ch0.temp_is_there>=2&&ch1.temp_is_there>=2){
				var split=nd.split;
				var ch0_active=(ch0.temp_has_active||ch0.temp_z_order>ch1.temp_z_order);
				if(nd.type=="hsplit"){
					dfsRender(ch0,x,y,w*split,h);
					dfsRender(ch1,x+w*split,y,w-w*split,h);
				}else{
					dfsRender(ch0,x,y,w,h*split);
					dfsRender(ch1,x,y+h*split,w,h-h*split);
				}
				//draw the separation shadow
				//nd.temp_has_active
				if(1){
					var sizing_rect=undefined;
					var shadow_rect=undefined;
					if(nd.type=="hsplit"){
						var x_split=x+w*split;
						if(ch0_active){
							sizing_rect={x:x_split,y:y,w:obj.shadow_size,h:h};
						}else{
							sizing_rect={x:x_split-obj.shadow_size,y:y,w:obj.shadow_size,h:h};
						}
						shadow_rect={x:x_split-obj.shadow_size,y:y-obj.shadow_size,w:obj.shadow_size*2,h:h+obj.shadow_size*2,
							color:obj.shadow_color,border_width:-obj.shadow_size,round:obj.shadow_size};
					}else{
						var y_split=y+h*split;
						if(ch0_active){
							sizing_rect={x:x,y:y_split,w:w,h:obj.shadow_size}
						}else{
							sizing_rect={x:x,y:y_split-obj.shadow_size,w:w,h:obj.shadow_size}
						}
						shadow_rect={x:x-obj.shadow_size,y:y_split-obj.shadow_size,w:w+obj.shadow_size*2,h:obj.shadow_size*2,
							color:obj.shadow_color,border_width:-obj.shadow_size,round:obj.shadow_size};
					}
					all_shadows.push(sizing_rect,shadow_rect)
					sizing_rect.nd=nd;
					sizing_rect.area_size={x:x,y:y,w:w,h:h};
					sizing_rect.mouse_cursor=(nd.type=="hsplit"?"sizewe":"sizens"),
					sizing_rect.__id="sizing_"+id_sizing_rect;
					id_sizing_rect++;
				}
			}else{
				dfsRender(ch0.temp_is_there>=2?ch0:ch1,x,y,w,h);
			}
		}else{
			//compute undragged layout
			var h_content=h-(obj.h_caption+obj.h_bar);
			if(h_content>0){
				var tab=windows_to_render[nd.name];
				rendered_areas.push({name:nd.name,x:x,y:y,w:w,h:h})
				if(tab){
					W.RoundRect("",{
						x:x,y:y+obj.h_caption,w:w,h:obj.h_bar,
						color:tab==obj.active_tab?obj.border_color_active:obj.border_color})
					UI.PushSubWindow(x,y+obj.h_caption+obj.h_bar,w,h_content)
					var rendering_action="normal";
					if(tab.NeedRendering&&enable_smart_tab_repainting){
						if(!UI.g_refresh_all_tabs&&tab.backup_x==x&&tab.backup_y==y&&tab.backup_w==w&&tab.backup_h==h&&!tab.NeedRendering()){
							//GL_CopyViewport
							if(!tab.backup_frame_id){
								//skip the first frame
								tab.backup_frame_id=1;
							}else if(tab.backup_frame_id==1){
								//do the backup, update frame id when one really does the backup
								rendering_action="backup";
							}else if(tab.backup_frame_id==2){
								//restore the backup
								rendering_action="restore";
							}
						}else{
							tab.backup_frame_id=0;
							tab.backup_regions=undefined;
						}
						tab.backup_x=x;
						tab.backup_y=y;
						tab.backup_w=w;
						tab.backup_h=h;
					}
					var s_wrapper_name="active_tab_obj_"+nd.name;
					if(obj[s_wrapper_name]&&obj[s_wrapper_name].tab!=tab){
						//destroy the stale tab wrapper
						obj[s_wrapper_name]=undefined;
					}
					var obj_tab=obj[s_wrapper_name];
					if(rendering_action=="restore"&&obj_tab){
						//print("restored tab - ",tab.title,s_wrapper_name,obj_tab)
						UI.context_parent.__children.push(obj_tab)
						UI.GLWidget(function(){
							UI.GL_RestoreFromBackupFBO(1);
						})
						var bk_focus_is_a_region=UI.context_focus_is_a_region;
						var bk_tentative_focus=UI.context_tentative_focus;
						for(var i=0;i<tab.backup_regions.length;i++){
							W.RestoreRegion(tab.backup_regions[i])
						}
						if(!bk_focus_is_a_region&&UI.context_focus_is_a_region&&obj.current_tab_id!=tab.__global_tab_id&&UI.nd_focus){
							obj.just_created_a_tab=0;
							obj.current_tab_id=tab.__global_tab_id;
							UI.InvalidateCurrentFrame()
							UI.Refresh()
						}
						if(tab!=obj.active_tab){
							//only auto-focus the active tab
							UI.context_tentative_focus=bk_tentative_focus;
						}
					}else{
						//print("RENDERED tab - ",tab.title,s_wrapper_name,obj_tab)
						var n0_auto_refresh=UI.n_auto_refreshes;
						if(rendering_action=="backup"){
							var n0_region=UI.context_regions.length;
							UI.GLWidget(function(){
								UI.GL_EnterBackupFBO();
							})
						}
						var n0_topmost=UI.RecordTopMostContext()
						obj_tab=UI.Keep(s_wrapper_name,W.RoundRect("",{
							x:0,y:0,w:w,h:h_content,tab:tab,
						}));
						UI.Begin(obj_tab)
							var bk_focus_is_a_region=UI.context_focus_is_a_region;
							var bk_tentative_focus=UI.context_tentative_focus;
							tab.body.call(tab)
							if(!bk_focus_is_a_region&&UI.context_focus_is_a_region&&obj.current_tab_id!=tab.__global_tab_id&&UI.nd_focus){
								obj.just_created_a_tab=0;
								obj.current_tab_id=tab.__global_tab_id;
								UI.InvalidateCurrentFrame()
								UI.Refresh()
							}
							if(tab!=obj.active_tab){
								//only auto-focus the active tab
								UI.context_tentative_focus=bk_tentative_focus;
							}
						UI.End()
						UI.FlushTopMostContext(n0_topmost)
						if(rendering_action=="backup"){
							UI.GLWidget(function(tab){
								//0 for backup
								UI.GL_LeaveBackupFBO();
								//if somehow the GLWidget is skipped (e.g. frame invalidated, we need to re-backup)
								tab.backup_frame_id=2;
							}.bind(undefined,tab));
							tab.backup_regions=[];
							for(var i=n0_region;i<UI.context_regions.length;i++){
								var rgn=UI.context_regions[i];
								for(var j=0;j<g_rerender_events.length;j++){
									var s_method_name=g_rerender_events[j];
									if(rgn[s_method_name]){
										rgn[s_method_name]=function(tab,rgn,fn,event){
											//force-update the tab
											tab.backup_x=undefined;
											fn.call(rgn,event);
										}.bind(undefined,tab,rgn,rgn[s_method_name])
									}
								}
								tab.backup_regions.push(rgn);
							}
						}
						if(n0_auto_refresh<UI.n_auto_refreshes){
							tab.backup_x=undefined;
						}
					}
					UI.PopSubWindow()
					tab.tooltip=obj_tab.body.tooltip
					if(obj_tab.body.title){
						if(tab.title!=obj_tab.body.title){
							tab.title=obj_tab.body.title
							UI.Refresh()
						}
					}
					var tabid=tab.__global_tab_id;
					W.SaveDialog("savedlg_"+tabid.toString(),{
						x:x,y:y+obj.h_caption+obj.h_bar,w:w,h:h_content,
						value:(tab.in_save_dialog||0),tabid:tabid,parent:obj})
				}else{
					//just draw tips
					UI.assert(nd.name=="doc_default");
					W.TipWindow("tips",{x:x,y:y+obj.h_caption+obj.h_bar,w:w,h:h_content})
				}
			}
		}
		nd.temp_is_there=undefined;
		nd.temp_has_active=undefined;
		nd.temp_z_order=undefined;
	};
	UI.HackCallback(dfsRender)
	if(layout.m_is_maximized&&obj.active_tab){
		var tab_maximized=obj.active_tab;
		windows_to_render={};
		windows_to_render[tab_maximized.area_name||"doc_default"]=tab_maximized;
		var dfsClearTemps=function(nd){
			if(nd.children){
				for(var i=0;i<nd.children.length;i++){
					dfsClearTemps(nd.children[i])
				}
			}
			nd.temp_is_there=undefined;
			nd.temp_has_active=undefined;
			nd.temp_z_order=undefined;
		};
		UI.HackCallback(dfsClearTemps)
		dfsClearTemps(layout);
		dfsRender({
			type:"doc",
			name:tab_maximized.area_name||"doc_default",
			temp_is_there:2,temp_has_active:1,temp_z_order:UI.g_current_z_value-1,
		},obj.x,obj.y+y_base,obj.w,obj.h-y_base)
	}else{
		dfsRender(layout,obj.x,obj.y+y_base,obj.w,obj.h-y_base)
	}
	return [rendered_areas,windows_to_render,all_shadows];
}

var SortTabsByArea=function(layout,obj){
	var order_by_name={};
	var order_id=0;
	var dfsComputeOrder=function(nd){
		if(nd.children){
			for(var i=0;i<nd.children.length;i++){
				dfsComputeOrder(nd.children[i]);
			}
		}else{
			order_by_name[nd.name]=order_id+(nd.name.length>=4&&nd.name.substr(0,4)=='doc_'?0:65536);
			order_id++;
		}
	}
	UI.HackCallback(dfsComputeOrder);
	dfsComputeOrder(layout)
	///////////////
	var bk_ui_item=[];
	var current_tab_id=obj.current_tab_id;
	for(var i=0;i<obj.items.length;i++){
		var item_i=obj.items[i];
		item_i.__global_tab_id=i;
		bk_ui_item[i]=obj[i];
	}
	obj.items.sort(function(a,b){
		return (order_by_name[a.area_name||"doc_default"]-order_by_name[b.area_name||"doc_default"])||(a.__global_tab_id-b.__global_tab_id);
	})
	for(var i=0;i<obj.items.length;i++){
		var item_i=obj.items[i];
		obj[i]=bk_ui_item[item_i.__global_tab_id];
		if(item_i.__global_tab_id==current_tab_id){
			obj.current_tab_id=i;
		}
		item_i.__global_tab_id=i;
	}
}

var TranslateTooltip=function(s){
	if(!s){return s;}
	var s=UI._(s);
	var p_hotkey=s.indexOf(' - ');
	if(p_hotkey>=0){
		s=s.substr(0,p_hotkey+3)+UI.LocalizeKeyName(UI.TranslateHotkey(s.substr(p_hotkey+3)));
	}
	return s;
};

UI.g_caption_scroll_by_name={};
W.TabbedDocument=function(id,attrs){
	var obj=UI.Keep(id,attrs,W.TabbedDocument_prototype);
	var auto_hide_menu=!UI.TestOption("always_show_menu");
	UI.StdStyling(id,obj,attrs, "tabbed_document");
	UI.StdAnchoring(id,obj);
	var items=obj.items
	var layout=UI.m_ui_metadata["<layout>"];
	if(!layout||typeof(layout)!='object'){
		layout=JSON.parse(IO.UIReadAll("res/misc/default_layout.json"));
		UI.m_ui_metadata["<layout>"]=layout;
	}
	if((obj.n_tabs_last_checked||0)<items.length){
		//new tab activating
		//this doesn't count as a meaningful switch
		//obj.current_tab_id=(items.length-1);
		obj.SetMenuState(0);
		obj.CancelTabDragging();
		UI.SaveWorkspace();
		//if(UI.Platform.BUILD=="debug"){
		//	print(">>> window opened");
		//	Duktape.gc();
		//	UI.dumpMemoryUsage();
		//}
	}
	obj.n_tabs_last_checked=items.length;
	if(!items.length&&obj.m_is_close_pending){
		obj.Close();
		return;
	}
	//sort items
	SortTabsByArea(layout,obj);
	UI.Begin(obj)
		for(var i=0;i<items.length;i++){
			items[i].__global_tab_id=i;
		}
		var tabid=(obj.current_tab_id||0);
		var n=items.length
		var y_label_area=obj.y
		var w_label_area=obj.w
		var w_menu_button=obj.w_menu_button+obj.padding*2;
		if(!auto_hide_menu){
			w_menu_button=0;
		}
		var w_menu=w_menu_button;
		//the big menu
		UI.m_global_menu=new W.CFancyMenuDesc()
		UI.BigMenu("&File");
		if(obj.m_is_in_menu||!auto_hide_menu){
			w_menu=obj.w;
			//if(layout.m_is_maximized){
			//	w_menu-=w_menu_button;
			//}
		}
		var anim=W.AnimationNode("menu_animation",{transition_dt:0.15,w_menu:w_menu})
		//menu shadow goes below tab label
		UI.RoundRect({
			x:obj.x-obj.menu_bar_shadow_size,y:obj.y-obj.menu_bar_shadow_size*0.5,
			w:anim.w_menu+obj.menu_bar_shadow_size*2,h:obj.h_caption+obj.menu_bar_shadow_size*1.5,
			round:obj.menu_bar_shadow_size,
			border_width:-obj.menu_bar_shadow_size,
			color:obj.menu_bar_shadow_color,
		})
		UI.RoundRect({
			x:obj.x,y:obj.y,w:anim.w_menu,h:obj.h_caption,
			color:obj.menu_bar_color,
		})
		if(obj.m_is_in_menu){
			//var is_1st=!obj.main_menu_bar;
			//but menu *bar* goes *above* the tab labels
			//if(is_1st){
			//	UI.SetFocus(obj.main_menu_bar)
			//}
		}else{
			UI.m_frozen_global_menu=undefined
			obj.m_menu_preselect=undefined
		}
		if(auto_hide_menu){
			W.Button("main_menu_button",{
				x:obj.x+obj.padding,y:y_label_area+0.5*(obj.h_caption-obj.h_menu_button),w:obj.w_menu_button,h:obj.h_menu_button,
				style:obj.menu_button_style,
				tooltip:'Menu',
				font:UI.icon_font,text:"单",
				value:obj.m_is_in_menu,
				OnChange:function(value){
					obj.SetMenuState(value);
				}})
		}
		obj.active_tab=items[tabid]
		//render the main layout
		var tmp_ret=RenderLayout(layout,obj,auto_hide_menu?0:obj.h_caption)
		var rendered_areas=tmp_ret[0];
		var windows_to_render=tmp_ret[1];
		var all_shadows=tmp_ret[2];
		//compute the caption layout
		var rendered_area_by_name={};
		for(var i=0;i<rendered_areas.length;i++){
			var area_i=rendered_areas[i];
			rendered_area_by_name[area_i.name]=area_i;
			area_i.content_box={x:area_i.x,y:area_i.y+obj.h_caption+obj.h_bar,w:area_i.w,h:Math.max(area_i.h-(obj.h_caption+obj.h_bar),0)}
			if(area_i.x==obj.x&&area_i.y==obj.y&&auto_hide_menu){
				area_i.x+=w_menu_button;
				area_i.w-=w_menu_button;
				if(layout.m_is_maximized){
					area_i.w-=w_menu_button;
				}
			}
			area_i.h=Math.min(obj.h_caption,area_i.h)
			area_i.tabs=[];
			area_i.x0_w_tabs=[];
		}
		for(var i=0;i<items.length;i++){
			var area_name=(items[i].area_name||"doc_default");
			//if(!rendered_area_by_name[area_name]){
			//	area_name="doc_default";
			//}
			if(rendered_area_by_name[area_name]){
				rendered_area_by_name[area_name].tabs.push(items[i]);
			}
		}
		var tab_label_style=UI.default_styles.tab_label;
		var area_autoscroll_target=undefined;
		var x_reveal_target=0;
		var w_active_tab=0;
		for(var i=0;i<rendered_areas.length;i++){
			var area_i=rendered_areas[i];
			if(!(area_i.w>0)){continue;}
			var x_caption=area_i.x;
			for(var j=0;j<area_i.tabs.length;j++){
				var tab_j=area_i.tabs[j];
				var w_j=UI.MeasureText(tab_label_style.font,tab_j.title).w+tab_label_style.padding*2;
				if(tab_j==obj.active_tab){
					area_autoscroll_target=area_i;
					x_reveal_target=x_caption;
					w_active_tab=w_j;
				}
				area_i.x0_w_tabs[j*2]=x_caption;
				area_i.x0_w_tabs[j*2+1]=w_j;
				x_caption+=w_j;
			}
			area_i.wtot=x_caption-area_i.x;
		}
		//render the captions
		if(obj.m_dragging_rendering_caption_areas){
			x_reveal_target=obj.m_dragging_mouse_x-obj.m_dragging_tab_x_offset;
			if(obj.m_dragging_tab_target){
				area_autoscroll_target=rendered_area_by_name[obj.m_dragging_tab_target.name];
			}
		}
		if(area_autoscroll_target){
			var scroll_x=(UI.g_caption_scroll_by_name[area_autoscroll_target.name]||0);
			x_reveal_target-=area_autoscroll_target.x;
			var scroll_x0=scroll_x;
			scroll_x=Math.min(Math.max(scroll_x,x_reveal_target+w_active_tab-area_autoscroll_target.w+tab_label_style.padding*2),x_reveal_target-tab_label_style.padding*2);
			scroll_x=Math.max(Math.min(scroll_x,area_autoscroll_target.wtot-area_autoscroll_target.w),0);
			if(scroll_x!=scroll_x0){
				UI.g_caption_scroll_by_name[area_autoscroll_target.name]=scroll_x;
				UI.Refresh()
			}
			//print(scroll_x,x_reveal_target,w_active_tab,area_autoscroll_target.w,area_autoscroll_target.wtot-area_autoscroll_target.w)
		}
		if(obj.m_dragging_rendering_caption_areas){
			var rendering_caption_areas=obj.m_dragging_rendering_caption_areas;
			for(var i=0;i<rendering_caption_areas.length;i++){
				var area_i=rendering_caption_areas[i];
				if(!(area_i.w>0)){continue;}
				var scroll_x=(UI.g_caption_scroll_by_name[area_i.name]||0);
				UI.PushCliprect(area_i.x,area_i.y,area_i.w,area_i.h);
				for(var j=0;j<area_i.tabs.length;j++){
					var tab_j=obj.items[area_i.tabs[j]];
					if(area_i.tabs[j]==obj.m_dragging_tab_src_tabid){continue;}
					W.TabLabel(tab_j.__global_tab_id,{
						x_animated:area_i.x0_w_tabs[j*2]-scroll_x,y:area_i.y,w:area_i.x0_w_tabs[j*2+1],h:area_i.h,
						selected:tab_j==windows_to_render[area_i.name]?tab_j==obj.active_tab?2:1:0,
						title:tab_j.title, tooltip:TranslateTooltip(tab_j.tooltip),
						hotkey_str:tab_j.__global_tab_id<10?String.fromCharCode(48+(tab_j.__global_tab_id+1)%10):undefined,
						tabid:tab_j.__global_tab_id,owner:obj})
				}
				UI.PopCliprect();
			}
			//active (src) tab
			var tab_dragging_src=obj.items[obj.m_dragging_tab_src_tabid];
			var w_src_at_target=UI.MeasureText(tab_label_style.font,tab_dragging_src.title).w+tab_label_style.padding*2;
			obj[tab_dragging_src.__global_tab_id]=undefined;
			UI.TopMostWidget(function(){
				W.TabLabel(tab_dragging_src.__global_tab_id,{
					x_animated:obj.m_dragging_mouse_x-obj.m_dragging_tab_x_offset,y:obj.m_dragging_mouse_y-obj.m_dragging_tab_y_offset,
					w:w_src_at_target,h:area_i.h,
					selected:2,
					title:tab_dragging_src.title, tooltip:TranslateTooltip(tab_dragging_src.tooltip),
					hotkey_str:tab_dragging_src.__global_tab_id<10?String.fromCharCode(48+(tab_dragging_src.__global_tab_id+1)%10):undefined,
					tabid:tab_dragging_src.__global_tab_id,owner:obj})
			})
			//splitting shade
			if(obj.m_dragging_tab_target&&obj.m_dragging_tab_target.split_side){
				var target_position=obj.m_dragging_tab_target;
				var box=rendering_caption_areas[target_position.area_id].content_box;
				var sside=target_position.split_side;
				var box_shade=undefined
				if(sside=="left"){
					box_shade={x:box.x,y:box.y,w:box.w*0.5,h:box.h}
				}else if(sside=="right"){
					box_shade={x:box.x+box.w*0.5,y:box.y,w:box.w*0.5,h:box.h}
				}else if(sside=="up"){
					box_shade={x:box.x,y:box.y,w:box.w,h:box.h*0.5}
				}else{
					UI.assert(sside=="down");
					box_shade={x:box.x,y:box.y+box.h*0.5,w:box.w,h:box.h*0.5}
				}
				if(box_shade){
					box_shade.color=obj.bgcolor_split_shade;
					box_shade.border_width=0;
					UI.RoundRect(box_shade)
				}
			}else if(obj.m_dragging_tab_target&&obj.m_dragging_tab_target.name!=(tab_dragging_src.area_name||"doc_default")){
				var target_position=obj.m_dragging_tab_target;
				var box=rendering_caption_areas[target_position.area_id].content_box;
				var sside=target_position.split_side;
				var box_shade={x:box.x,y:box.y,w:box.w,h:box.h};
				box_shade.color=obj.bgcolor_split_shade;
				box_shade.border_width=0;
				UI.RoundRect(box_shade);
			}
		}else{
			for(var pass_i=0;pass_i<2;pass_i++){
				for(var i=0;i<rendered_areas.length;i++){
					var area_i=rendered_areas[i];
					if(!(area_i.w>0)){continue;}
					var scroll_x=(UI.g_caption_scroll_by_name[area_i.name]||0);
					UI.PushCliprect(area_i.x,area_i.y,area_i.w,area_i.h);
					for(var j=0;j<area_i.tabs.length;j++){
						var tab_j=area_i.tabs[j];
						if((tab_j==obj.active_tab)==(pass_i==1)){
							W.TabLabel(tab_j.__global_tab_id,{
								x_animated:area_i.x0_w_tabs[j*2]-scroll_x,y:area_i.y,w:area_i.x0_w_tabs[j*2+1],h:area_i.h,
								selected:tab_j==windows_to_render[area_i.name]?tab_j==obj.active_tab?2:1:0,
								title:tab_j.title, tooltip:TranslateTooltip(tab_j.tooltip),
								hotkey_str:tab_j.__global_tab_id<10?String.fromCharCode(48+(tab_j.__global_tab_id+1)%10):undefined,
								tabid:tab_j.__global_tab_id,owner:obj})
						}
					}
					//if(pass_i==1){
					//	//scrolling regions
					//	if(scroll_x>0){
					//	}
					//	if(area_i.wtot>area_i.w&&scroll_x<area_i.wtot-area_i.w){
					//	}
					//}
					UI.PopCliprect();
				}
			}
			//save areas for dragging
			for(var i=0;i<rendered_areas.length;i++){
				rendered_areas[i].tabs=rendered_areas[i].tabs.map(function(a){return a.__global_tab_id});
			}
			obj.m_caption_areas=rendered_areas;
		}
		//render the separation shadows
		for(var i=0;i<all_shadows.length;i+=2){
			var sizing_rect=all_shadows[i+0];
			var shadow_rect=all_shadows[i+1];
			UI.PushCliprect(sizing_rect.x,sizing_rect.y,sizing_rect.w,sizing_rect.h);
			UI.RoundRect(shadow_rect);
			W.Region(sizing_rect.__id,sizing_rect,g_sizing_rect_prototype)
			UI.PopCliprect();
		}
		//restore button
		if(layout.m_is_maximized&&!obj.m_is_in_menu&&auto_hide_menu){
			//UI.RoundRect({
			//	x:obj.x+obj.w-w_menu_button,y:obj.y,w:w_menu_button,h:obj.h_caption,
			//	color:obj.menu_bar_color,
			//})
			W.Button("restore_button",{
				x:obj.x+obj.w-obj.padding-obj.w_menu_button,y:y_label_area+0.5*(obj.h_caption-obj.h_menu_button),
				w:obj.w_menu_button,h:obj.h_menu_button,
				style:obj.menu_button_style,
				tooltip:TranslateTooltip('Restore tab size - ESC'),
				font:UI.icon_font,text:"还",
				value:0,
				OnClick:function(){
					obj.ToggleMaximizeMode();
				}})
		}
		//show the active-caption as a part of the menu
		var s_active_title=(obj.active_tab&&obj.active_tab.title);
		var w_menu_bar=anim.w_menu-w_menu_button;
		if(anim.w_menu-w_menu_button>0){
			UI.RoundRect({
				x:obj.x+w_menu_button,y:obj.y,w:anim.w_menu-w_menu_button,h:obj.h_caption,
				color:obj.menu_bar_color,
				border_width:obj.menu_bar_border_width,
				border_color:obj.menu_bar_border_color,
			})
			if(s_active_title&&auto_hide_menu){
				var dims=UI.MeasureText(tab_label_style.font,s_active_title)
				dims.w+=4;
				UI.PushCliprect(obj.x+w_menu_button,obj.y,w_menu_bar,obj.h_caption);
					W.Text("",{
						x:obj.x+w_menu_button+w_menu_bar-dims.w,y:obj.y+(obj.h_caption-dims.h)*0.5,
						font:tab_label_style.font,text:s_active_title,
						color:obj.menu_bar_caption_text_color,
					});
				UI.PopCliprect();
				w_menu_bar-=dims.w;
			}
		}
		obj.fmenu_callback()
		if(obj.m_is_in_menu||!auto_hide_menu){
			//menu *bar* goes *above* the tab labels
			if(!obj.m_is_in_menu){
				//if(obj.main_menu_bar){
				//	var bk_listview=obj.main_menu_bar.list_view;
				//	obj.main_menu_bar={list_view:bk_listview};
				//}
				obj.main_menu_bar=undefined;
				obj.m_menu_preselect=undefined;
			}
			if(w_menu_bar>0){
				W.TopMenuBar("main_menu_bar",{x:obj.x+w_menu_button,w:w_menu_bar,y:obj.y,h:obj.h_caption,
					default_value:obj.m_menu_preselect,
					owner:obj})
			}
		}
		///////////////////////////
		//tab menu context
		if(obj.m_menu_context){
			UI.TopMostWidget(function(){
				var is_first=!obj.context_menu;
				var obj_submenu=W.FancyMenu("tab_context_menu",{
					x:obj.m_menu_context.x, y:obj.m_menu_context.y,
					desc:obj.m_menu_context.menu,
					HideMenu:function(){obj.m_menu_context=undefined;},
				})
				if(is_first){UI.SetFocus(obj_submenu);}
			})
		}else{
			obj.tab_context_menu=undefined;
		}
	UI.End()
	if(!obj.m_is_in_menu){
		if(UI.Platform.ARCH!="mac"&&UI.Platform.ARCH!="ios"){
			W.Hotkey("",{key:"CTRL+F4",action:function(){
				var num_id=tabid
				if(num_id<0){return;}
				obj.CloseTab(num_id)
			}});
		}
		W.Hotkey("",{key:"CTRL+W",action:function(){
			var num_id=tabid
			if(num_id<0){return;}
			obj.CloseTab(num_id)
		}});
		W.Hotkey("",{key:"CTRL+TAB",action:function(){
			var num_id=tabid
			if(num_id<0){return;}
			num_id++;if(num_id>=items.length){num_id=0;}
			//this doesn't count as a meaningful switch, it's in-transit
			obj.just_created_a_tab=0;
			obj.current_tab_id=num_id
			UI.SetFocus(undefined)
			UI.Refresh()
		}});
		W.Hotkey("",{key:"CTRL+SHIFT+TAB",action:function(){
			var num_id=tabid
			if(num_id<0){return;}
			if(!num_id){num_id=items.length;}
			num_id--;
			//this doesn't count as a meaningful switch, it's in-transit
			obj.just_created_a_tab=0;
			obj.current_tab_id=num_id
			UI.SetFocus(undefined)
			UI.Refresh()
		}});
		for(var i=0;i<items.length&&i<10;i++){
			W.Hotkey("",{key:(UI.Platform.ARCH=="mac"?"WIN+":"ALT+")+String.fromCharCode(48+(i+1)%10),action:(function(obj,i){
				obj.SetTab(i)
				UI.Refresh()
			}).bind(null,obj,i)})
		}
		var cur_hotkeys={};
		for(var i=0;i<UI.context_hotkeys.length;i++){
			cur_hotkeys[UI.context_hotkeys[i].key]=1;
		}
		for(var i=0;i<UI.m_global_menu.$.length;i++){
			var s_text=UI.m_global_menu.$[i].text
			if(s_text){
				var p_and=s_text.indexOf('&')
				if(p_and>=0){
					var skey=(UI.Platform.ARCH=="mac"?"ALT+WIN+":"ALT+")+s_text.substr(p_and+1,1).toUpperCase();
					if(cur_hotkeys[skey]){continue;}
					W.Hotkey("",{key:skey,action:
						(function(obj,i){
							obj.m_menu_preselect=i;
							obj.SetMenuState(1);
							UI.InvalidateCurrentFrame()
							UI.Refresh()
						}).bind(null,obj,i)})
				}
			}
		}
	}
	UI.m_the_document_area=obj;
	UI.g_refresh_all_tabs=0;
	return obj
}

////////////////////////////////////////////////////////
W.SaveDialog_prototype={
	GetSubStyle:function(){
		return this.value?"active":"inactive"
	},
};
W.SaveDialog=function(id,attrs){
	//value: enabled-ness
	var obj=UI.StdWidget(id,attrs,"save_dialog",W.SaveDialog_prototype)
	UI.RoundRect(obj)
	UI.Begin(obj)
		//coulddo: use blur instead
		if(obj.value){
			var region=W.Region("savedlg_region",{x:obj.x,y:obj.y,w:obj.w,h:obj.h})
			UI.SetFocus(region)
			var s_text0=UI._("It's not saved yet...")
			var s_text_y=UI._("Save")
			var s_text_n=UI._("Don't save")
			var s_text_c=UI._("Cancel")
			var sz_text=UI.MeasureText(obj.font_text,s_text0)
			var sz_buttons=UI.MeasureText(obj.font_buttons,s_text_y)
			sz_buttons.w+=UI.MeasureText(obj.font_buttons,s_text_n).w
			sz_buttons.w+=UI.MeasureText(obj.font_buttons,s_text_c).w
			sz_buttons.w+=obj.space_button*2+obj.good_button_style.padding*2
			var h_content=obj.space_middle+sz_text.h+obj.h_button
			var y_text=obj.y+(obj.h-h_content)*0.5
			var y_buttons=y_text+sz_text.h+obj.space_middle
			var x_buttons=obj.x+(obj.w-sz_buttons.w)*0.5
			var w_dlg_rect=Math.max(sz_text.w,sz_buttons.w)+obj.space_dlg_rect_x*2
			var h_dlg_rect=h_content+obj.space_dlg_rect*2
			UI.RoundRect({
				x:obj.x+(obj.w-w_dlg_rect)*0.5,y:obj.y+(obj.h-h_dlg_rect)*0.5,
				w:w_dlg_rect+obj.shadow_size*0.5,h:h_dlg_rect+obj.shadow_size*0.5,
				round:obj.shadow_size,border_width:-obj.shadow_size,color:obj.shadow_color
			})
			UI.RoundRect({x:obj.x+(obj.w-w_dlg_rect)*0.5,y:obj.y+(obj.h-h_dlg_rect)*0.5,w:w_dlg_rect,h:h_dlg_rect,
				round:obj.round_dlg_rect,border_width:obj.border_width,border_color:obj.border_color,color:obj.color_dlg_rect
			})
			W.Text("",{x:obj.x+(obj.w-sz_text.w)*0.5,y:y_text, font:obj.font_text,text:s_text0,color:obj.text_color})
			var fyes=function(){
				var darea=obj.parent
				obj.parent.SaveTab(obj.tabid)
				obj.parent.CloseTab(obj.tabid)
				obj.parent=undefined
				UI.Refresh()
				if(darea.m_is_close_pending){
					if(!UI.top.app.OnClose()){UI.DestroyWindow(UI.top.app)}
				}
			}
			var fno=function(){
				var darea=obj.parent
				obj.parent.CloseTab(obj.tabid,"forced")
				obj.parent=undefined
				UI.Refresh()
				if(darea.m_is_close_pending){
					if(!UI.top.app.OnClose()){UI.DestroyWindow(UI.top.app)}
				}
			}
			var fcancel=function(){
				obj.parent.items[obj.tabid].in_save_dialog=0
				obj.parent.m_is_close_pending=0
				obj.parent=undefined
				UI.Refresh()
			}
			W.Button("btn_y",{x:x_buttons,y:y_buttons,h:obj.h_button, font:obj.font_buttons,text:s_text_y,style:obj.good_button_style,OnClick:fyes});
			x_buttons+=UI.MeasureText(obj.font_buttons,s_text_y).w+obj.space_button
			W.Button("btn_n",{x:x_buttons,y:y_buttons,h:obj.h_button, font:obj.font_buttons,text:s_text_n,style:obj.bad_button_style,OnClick:fno});
			x_buttons+=UI.MeasureText(obj.font_buttons,s_text_n).w+obj.space_button
			W.Button("btn_c",{x:x_buttons,y:y_buttons,h:obj.h_button, font:obj.font_buttons,text:s_text_c,style:obj.bad_button_style,OnClick:fcancel});
			W.Hotkey("",{key:"Y",action:fyes});W.Hotkey("",{key:"S",action:fyes});W.Hotkey("",{key:"RETURN",action:fyes});W.Hotkey("",{key:"SPACE",action:fyes})
			W.Hotkey("",{key:"N",action:fno});W.Hotkey("",{key:"D",action:fno})
			W.Hotkey("",{key:"ESC",action:fcancel});W.Hotkey("",{key:"C",action:fcancel})
			/////////////////
			//disable the side window as well
			UI.document_property_sheet={};
		}
	UI.End(obj)
}

////////////////////////////////////////////////////////
//text (colored), rubber, button, newline (with optional line-wide event)
//var g_menu_action_invoked=0;
var WrapMenuAction=function(action){
	if(!action){return action;}
	UI.HackCallback(action)
	return UI.HackCallback(function(){
		//g_menu_action_invoked=1;
		UI.SetFocus(null);
		UI.InvalidateCurrentFrame();
		UI.Refresh()
		action();
	});
}

W.CFancyMenuDesc=function(){
	this.$=[];
}
W.CFancyMenuDesc.prototype={
	AddNormalItem:function(attrs){
		var style=UI.default_styles['fancy_menu']
		var children=this.$
		children.push({type:'text',icon:attrs.icon,text:UI._(attrs.text),
			color:attrs.action?style.text_color:style.hotkey_color,
			icon_color:attrs.icon=="■"||attrs.icon=="□"?style.icon_color:style.text_color,
			context_menu_group:attrs.context_menu_group,
			tab_menu_group:attrs.tab_menu_group,
			sel_icon_color:style.text_sel_color,
			sel_color:style.text_sel_color})
		if(attrs.action){attrs.action=WrapMenuAction(attrs.action);}
		var p_and=attrs.text.indexOf('&')
		if(p_and>=0&&attrs.action){
			//underlined hotkey
			children.push({type:'hotkey',key:attrs.text.substr(p_and+1,1).toUpperCase(),
				context_menu_group:attrs.context_menu_group,
				tab_menu_group:attrs.tab_menu_group,
				action:attrs.action})
			if(UI.Platform.ARCH!="mac"){
				children.push({type:'hotkey',key:"ALT+"+attrs.text.substr(p_and+1,1).toUpperCase(),
					context_menu_group:attrs.context_menu_group,
					tab_menu_group:attrs.tab_menu_group,
					action:attrs.action})
			}
		}
		if(attrs.key){
			children.push(
				{type:'rubber',context_menu_group:attrs.context_menu_group,tab_menu_group:attrs.tab_menu_group},
				{type:'text',context_menu_group:attrs.context_menu_group,tab_menu_group:attrs.tab_menu_group,
					text:UI.LocalizeKeyName(UI.TranslateHotkey(attrs.key)),
					color:style.hotkey_color,sel_color:style.hotkey_sel_color})
			if(attrs.enable_hotkey&&attrs.action){W.Hotkey("",{key:attrs.key,action:attrs.action})}
		}
		children.push({type:'newline',context_menu_group:attrs.context_menu_group,tab_menu_group:attrs.tab_menu_group,action:attrs.action})
	},
	AddButtonRow:function(attrs,buttons){
		var style=UI.default_styles['fancy_menu']
		var children=this.$
		children.push({type:'text',icon:attrs.icon,text:UI._(attrs.text),
			icon_color:style.text_color,
			color:style.text_color,sel_color:style.text_sel_color},{type:'rubber'})
		for(var i=0;i<buttons.length;i++){
			var button_i=buttons[i]
			button_i.type='button';
			button_i.action=WrapMenuAction(button_i.action);
			children.push(button_i);
			/////////////////
			if(button_i.text){
				var p_and=button_i.text.indexOf('&')
				if(p_and>=0){
					//underlined hotkey
					children.push({type:'hotkey',key:button_i.text.substr(p_and+1,1).toUpperCase(),action:button_i.action})
					if(UI.Platform.ARCH!="mac"){
						children.push({type:'hotkey',key:'ALT+'+button_i.text.substr(p_and+1,1).toUpperCase(),action:button_i.action})
					}
				}
			}
			if(button_i.key){
				W.Hotkey("",{key:button_i.key,action:button_i.action})
			}
		}
		children.push({type:'newline'})
	},
	AddSeparator:function(){
		var children=this.$
		children.push({type:'separator'})
	}
}

UI.BigMenu=function(){
	var menu=UI.m_global_menu;
	var style=UI.default_styles['fancy_menu']
	for(var i=0;i<arguments.length;i++){
		var name=UI._(arguments[i]);
		//if(UI.Platform.ARCH=="mac"){
		//	name=name.replace('&','')
		//}
		if(!menu[name]){
			//if(menu==UI.m_global_menu){
			//}else{
			//	menu.$.push(
			//		{type:'text',text:name,color:style.text_color},
			//		{type:'rubber'},
			//		{type:'text',text:'\u25B6',color:style.text_color},
			//		{type:'newline',action:function(){
			//			//where do we open submenus... left-down
			//			//need to think over how to do the "popup"
			//		}},
			//	)
			//}
			menu[name]=new W.CFancyMenuDesc()
			menu.$.push(
				{'type':'submenu','text':name,'menu':menu[name]}
			)
		}
		menu=menu[name];
	}
	return menu
}

//make the top menu horizontal and disable nested child menus? with scrollable menus... it should work
W.TopMenuItem=function(id,attrs){
	var obj=UI.Keep(id,attrs);
	UI.StdStyling(id,obj,attrs, "top_menu_item",obj.selected&&obj.owner.owner.m_is_in_menu?"active":"inactive");
	var text_attrs={font:obj.font,text:obj.text,color:obj.text_color,flags:8}
	if(!text_attrs.__layout){UI.LayoutText(text_attrs);}
	obj.w=(obj.w||text_attrs.w_text+obj.padding*2);
	obj.h=(obj.h||text_attrs.h_text);
	UI.StdAnchoring(id,obj);
	UI.RoundRect(obj)
	UI.Begin(obj)
		text_attrs.x=obj.x+obj.padding
		text_attrs.y=obj.y+0.5*(obj.h-text_attrs.h_text)
		W.Text("",text_attrs)
		var owner=obj.owner
		var parent=owner.list_view
		var p_and=attrs.text.indexOf('&')
		if(p_and>=0&&UI.top.app.document_area.m_is_in_menu){
			//hotkey - listview selection setting
			W.Hotkey("",{key:attrs.text.substr(p_and+1,1).toUpperCase(),action:function(){
				parent.OnChange(parseInt(obj.id.substr(1)))
				owner.m_show_sub_menus=!owner.m_show_sub_menus;
				UI.Refresh()
			}})
		}
		//the submenu
		if(obj.selected&&owner.m_show_sub_menus){
			//placement... leftmost left, other right
			UI.TopMostWidget(function(){
				var obj_submenu=W.FancyMenu("sub_menu_"+id,{
					x:id=='$0'?0:obj.x-4,y:owner.y+owner.h,
					desc:obj.menu,
					HideMenu:function(){owner.owner.SetMenuState(0);},
					parent_menu_list_view:owner.list_view,
				})
				UI.SetFocus(obj_submenu)
			})
		}
	UI.End()
	return obj;
}

W.TopMenuBar=function(id,attrs){
	var obj=UI.Keep(id,attrs);
	UI.StdStyling(id,obj,attrs, "top_menu");
	UI.StdAnchoring(id,obj);
	var desc=(UI.m_frozen_global_menu||UI.m_global_menu)
	//var lv_items=[]
	//for(var i=0;i<desc.$.length;i++){
	//	var submenu_i=desc.$[i];
	//	if(submenu_i.object_type!='submenu'){throw new Error('only submenus allows at the top level')}
	//	lv_items[i]={'text':submenu_i.text}
	//}
	//UI.RoundRect(obj)
	UI.Begin(obj)
		var is_first=(!obj.m_was_in_menu&&obj.owner.m_is_in_menu);
		obj.m_was_in_menu=obj.owner.m_is_in_menu;
		var fshow_sub_menus=function(){
			obj.m_show_sub_menus=1
			UI.Refresh()
		}
		var ftoggle_sub_menus=function(){
			obj.m_show_sub_menus=!obj.m_show_sub_menus;
			UI.Refresh()
		}
		var bk_tentative_focus=UI.context_tentative_focus;
		UI.PushCliprect(obj.x,obj.y+2,obj.w,obj.h-4)
		W.ListView('list_view',{x:obj.x,y:obj.y+2,w:obj.w,h:obj.h-4,
			dimension:'x',layout_spacing:8,is_single_click_mode:1,
			item_template:{object_type:W.TopMenuItem,owner:obj,OnDblClick:fshow_sub_menus},
			items:desc.$,
			OnChange:function(value){
				this.value=value;
				this.item_template.owner.owner.SetMenuState(1);
				//fshow_sub_menus()
				UI.Refresh();
			}
		})
		UI.PopCliprect()
		UI.context_tentative_focus=bk_tentative_focus;
		if(!obj.m_show_sub_menus&&obj.owner.m_is_in_menu){
			W.Hotkey("",{key:"DOWN",action:fshow_sub_menus})
			W.Hotkey("",{key:"RETURN RETURN2",action:ftoggle_sub_menus})
			W.Hotkey("",{key:"ESC",action:(function(obj){obj.owner.SetMenuState(0);UI.Refresh();}).bind(null,obj)})
			if(is_first&&!obj.m_show_sub_menus){
				UI.SetFocus(obj.list_view);
			}
			if(is_first&&obj.default_value!=undefined){
				obj.list_view.OnChange(obj.default_value);
				obj.m_show_sub_menus=1
				UI.InvalidateCurrentFrame();
				UI.Refresh();
			}
			//if(g_menu_action_invoked){
			//	UI.SetFocus(null)
			//	g_menu_action_invoked=0;
			//}
		}
	UI.End()
	desc=undefined;
	return obj;
}

W.FancyMenu_prototype={
	OnBlur:function(obj_new){
		if(!obj_new||Object.getPrototypeOf(obj_new)!=W.FancyMenu_prototype){
			this.HideMenu();
			UI.Refresh()
		}
	},
	OnKeyDown:function(event){
		var sel=(this.value||0)
		var n=Math.max(this.selectable_items.length,1)
		var IsHotkey=UI.IsHotkey
		if(0){
		}else if(IsHotkey(event,"UP")){
			//item id selection
			sel--
			if(sel<0){sel=n-1;}
			this.value=sel;
			UI.Refresh()
		}else if(IsHotkey(event,"DOWN")){
			sel++
			if(sel>=n){sel=0;}
			this.value=sel;
			UI.Refresh()
		}
		else if(IsHotkey(event,"LEFT")&&this.parent_menu_list_view){
			var list_view=this.parent_menu_list_view
			n=list_view.items.length;
			sel=(list_view.value||0)
			sel--
			if(sel<0){sel=n-1;}
			list_view.OnChange(sel)
			UI.Refresh()
		}else if(IsHotkey(event,"RIGHT")&&this.parent_menu_list_view){
			var list_view=this.parent_menu_list_view
			n=list_view.items.length;
			sel=(list_view.value||0)
			sel++
			if(sel>=n){sel=0;}
			list_view.OnChange(sel)
			UI.Refresh()
		}else if(IsHotkey(event,"ESC")){
			this.HideMenu();
			UI.Refresh()
		}else if(IsHotkey(event,"RETURN RETURN2")){
			this.desc.$[this.selectable_items[sel]].action()
			UI.Refresh()
		}
	},
};
W.FancyMenu=function(id,attrs){
	var obj=UI.Keep(id,attrs,W.FancyMenu_prototype);
	UI.StdStyling(id,obj,attrs, "fancy_menu");
	var items=obj.desc.$
	var w_icon=obj.w_icon
	var x_icon=obj.side_padding
	if(!obj.w){
		//measure w,h, create rendering aid for the items... write in place
		var per_part_w=[]
		var part_id=0,w_acc=0,h_acc=0;
		for(var i=0;i<items.length;i++){
			var item_i=items[i]
			var s_type=item_i.type
			var dx=0;
			if(s_type=='text'){
				w_acc+=UI.MeasureText(obj.font,item_i.text.replace('&','')).w
			}else if(s_type=='button'){
				w_acc+=UI.MeasureText(obj.font,item_i.icon||item_i.text).w
				w_acc+=obj.button_padding*2
			}else if(s_type=='rubber'){
				per_part_w[part_id]=Math.max(per_part_w[part_id]||0,w_acc)
				part_id++
				w_acc=0
			}else if(s_type=='separator'){
				h_acc+=obj.h_separator
			}else if(s_type=='newline'){
				per_part_w[part_id]=Math.max(per_part_w[part_id]||0,w_acc)
				part_id=0
				w_acc=0
				h_acc+=obj.h_menu_line
			}
			//ignore 'hotkey'
		}
		var w_needed=obj.side_padding+w_icon
		for(var i=0;i<per_part_w.length;i++){
			w_needed+=per_part_w[i]+obj.column_padding
			per_part_w[i]=w_needed
		}
		w_needed+=obj.side_padding-obj.column_padding
		obj.w=w_needed
		obj.h=h_acc+obj.vertical_padding*2
		//compute x y w h everywhere, assign icon with text and draw it at 0,y
		var selectable_items=[]
		part_id=0;w_acc=obj.side_padding+w_icon;h_acc=obj.vertical_padding;
		for(var i=0;i<items.length;i++){
			var item_i=items[i]
			var s_type=item_i.type
			var dx=0;
			if(s_type=='text'){
				item_i.x=w_acc
				item_i.y=h_acc
				w_acc+=UI.MeasureText(obj.font,item_i.text.replace('&','')).w
			}else if(s_type=='button'){
				item_i.x=w_acc
				item_i.y=h_acc+(obj.h_menu_line-obj.h_button)*0.5
				w_acc+=obj.button_padding
				w_acc+=UI.MeasureText(obj.font,item_i.icon||item_i.text).w
				w_acc+=obj.button_padding
				item_i.w=w_acc-item_i.x
				item_i.h=obj.h_button
				selectable_items.push(i)
			}else if(s_type=='rubber'){
				w_acc=per_part_w[part_id]
				part_id++
			}else if(s_type=='separator'){
				item_i.x=obj.side_padding;
				item_i.y=h_acc+(obj.h_separator-obj.h_separator_fill)*0.5
				item_i.w=w_needed-obj.side_padding*2;
				h_acc+=obj.h_separator
				w_acc=obj.side_padding+w_icon;
			}else if(s_type=='newline'){
				var right_space=w_needed-w_acc-obj.side_padding
				if(right_space>0&&part_id>0){
					for(var j=i-1;j>=0;j--){
						var item_j=items[j]
						if(item_j.type=='newline'||item_j.type=='rubber'||item_j.type=='separator'){break;}
						if(item_j.x!=undefined){item_j.x+=right_space}
					}
				}
				item_i.x=obj.side_padding*0.5
				item_i.y=h_acc
				item_i.w=w_needed-obj.side_padding
				item_i.h=obj.h_menu_line
				part_id=0;
				w_acc=obj.side_padding+w_icon;
				h_acc+=obj.h_menu_line
				if(item_i.action){
					item_i.sel_id=selectable_items.length
					selectable_items.push(i)
				}
			}
			//again ignore 'hotkey'
		}
		obj.selectable_items=selectable_items
	}
	/////////////////
	UI.StdAnchoring(id,obj);
	UI.RoundRect({x:obj.x,y:obj.y,w:obj.w+obj.shadow_size,h:obj.h+obj.shadow_size,
		color:obj.shadow_color,
		border_width:-obj.shadow_size,round:obj.shadow_size})
	UI.RoundRect(obj)
	var bk_tentative_focus=UI.context_tentative_focus;
	W.PureRegion(id,obj);
	UI.context_tentative_focus=bk_tentative_focus;
	UI.Begin(obj)
	var hc=UI.GetCharacterHeight(obj.font)
	var hc_icon=UI.GetCharacterHeight(UI.icon_font_20)
	var sel_id1=obj.selectable_items[obj.value||0]
	var sel_id0=sel_id1
	if(items[sel_id1].type=='newline'){
		sel_id0--
		while(sel_id0>=0&&items[sel_id0].type!='newline'){
			sel_id0--;
		}
		sel_id0++
	}
	for(var i=0;i<items.length;i++){
		var item_i=items[i]
		var s_type=item_i.type
		var dx=0;
		var selected=(i>=sel_id0&&i<=sel_id1)
		if(sel_id0<sel_id1&&i==sel_id0){
			var item_sel1=items[sel_id1]
			UI.RoundRect({x:obj.x+item_sel1.x,y:obj.y+item_sel1.y,w:item_sel1.w,h:item_sel1.h,
				color:obj.sel_bgcolor,
			})
		}
		if(s_type=='text'){
			W.Text("",{x:obj.x+item_i.x,y:obj.y+item_i.y+(obj.h_menu_line-hc)*0.5,font:obj.font,text:item_i.text,color:selected?item_i.sel_color:item_i.color,flags:8})
			if(item_i.icon){
				//W.Text("",{x:obj.x+x_icon,y:obj.y+item_i.y+(obj.h_menu_line-hc_icon)*0.5,font:UI.icon_font_20,text:item_i.icon,
				//	color:selected?item_i.sel_icon_color:item_i.icon_color})
				UI.DrawChar(UI.icon_font_20,
					obj.x+x_icon,obj.y+item_i.y+(obj.h_menu_line-hc_icon)*0.5,
					selected?item_i.sel_icon_color:item_i.icon_color,
					item_i.icon.charCodeAt(0))
			}
		}else if(s_type=='button'){
			W.Button(item_i.text,{x:obj.x+item_i.x,y:obj.y+item_i.y,w:item_i.w,h:item_i.h,
				font:item_i.icon?obj.button_style.icon_font:obj.button_style.font,text:item_i.icon||item_i.text,OnClick:item_i.action,
				value:selected,
				show_tooltip_override:selected,
				style:obj.button_style,
				tooltip:TranslateTooltip(item_i.tooltip),
				flags:8})
		}else if(s_type=='separator'){
			UI.RoundRect({x:obj.x+item_i.x,y:obj.y+item_i.y,w:item_i.w,h:obj.h_separator_fill,
				color:obj.separator_color,
			})
		}else if(s_type=='newline'){
			if(item_i.action){
				W.Region("line_"+i.toString(),{
					x:obj.x+item_i.x,y:obj.y+item_i.y,w:item_i.w,h:item_i.h,
					OnClick:item_i.action,
					sel_id:item_i.sel_id,
					OnMouseOver:function(){obj.value=this.sel_id;UI.Refresh()}})
			}
		}else if(s_type=='hotkey'){
			W.Hotkey("",{key:item_i.key,action:item_i.action})
		}
	}
	UI.End()
	return obj
}

UI.CreateContextMenu=function(group_name){
	var menu=UI.m_global_menu;
	if(!menu){return undefined;}
	var context_menu_groups={};
	var dfs=function(menu){
		for(var i=0;i<menu.$.length;i++){
			var item_i=menu.$[i];
			if(item_i[group_name]){
				var group=context_menu_groups[item_i[group_name]];
				if(!group){
					group=[];
					context_menu_groups[item_i[group_name]]=group;
				}
				group.push(item_i);
				continue;
			}
			if(item_i.type=='submenu'){
				dfs(item_i.menu);
			}
		}
	}
	dfs(menu);
	menu=undefined;
	//////////////////////
	var keys=[];
	for(var s_key in context_menu_groups){
		keys.push(s_key)
	}
	if(!keys.length){return undefined;}
	keys.sort();
	var menu_context=new W.CFancyMenuDesc();
	for(var i=0;i<keys.length;i++){
		if(i){
			menu_context.AddSeparator()
		}
		menu_context.$=menu_context.$.concat(context_menu_groups[keys[i]])
	}
	return menu_context;
}

//coulddo: menu search support - we don't have enough commands to justify it
W.TipWindow_prototype={
	OnClick:function(event){
		UI.top.app.document_area.SetMenuState(0)
		UI.Refresh()
	}
};

var LoadTips=function(){
	var s_md=IO.UIReadAll("res/misc/tips_"+UI.m_ui_language+".md");
	if(!s_md){
		s_md=IO.UIReadAll("res/misc/tips_en_us.md");
	}
	var tips=s_md.split("#");
	UI.m_tips=[];
	for(var i=0;i<tips.length;i++){
		var s_i=tips[i];
		if(!s_i){continue;}
		s_i=s_i.replace(/^@([^@]+)@ /g,function(smatch,stext){
			return UI.ED_RichTextCommandChar(UI.RICHTEXT_COMMAND_SET_STYLE+3)+stext+UI.ED_RichTextCommandChar(UI.RICHTEXT_COMMAND_SET_STYLE+1)+' ';
		})
		s_i=s_i.replace(/@([^@]+)@/g,function(smatch,stext){
			return UI.ED_RichTextCommandChar(UI.RICHTEXT_COMMAND_SET_STYLE+4)+stext+UI.ED_RichTextCommandChar(UI.RICHTEXT_COMMAND_SET_STYLE+0);
		})
		var code_segs=s_i.split('`');
		var code_segs2=[];
		for(var j=0;j<code_segs.length;j++){
			if(j>0){
				code_segs2.push(UI.ED_RichTextCommandChar(UI.RICHTEXT_COMMAND_SET_STYLE+(j&1?2:0)))
			}
			code_segs2.push(code_segs[j]);
		}
		UI.m_tips.push({m_text:code_segs2.join('')});
	}
}

W.TipWindow=function(id,attrs){
	var obj=UI.StdWidget(id,attrs,"tip_window",W.TipWindow_prototype)
	W.PureRegion(id,obj);
	var tip_id=UI.m_ui_metadata["<tip_id>"];
	if(tip_id==undefined){tip_id=0;}
	if(!UI.m_tips){
		LoadTips();
		//tip_id++;
		//if(tip_id>=UI.m_tips.length){
		//	tip_id--;
		//}
		UI.m_ui_metadata["<tip_id>"]=tip_id;
	}
	UI.Begin(obj)
		var desc=UI.m_tips[tip_id];
		if(!desc.m_cached_prt){
			desc.m_cached_prt=UI.ED_FormatRichText(
				Language.GetHyphenator(UI.m_ui_language),
				desc.m_text,4,obj.w_text,obj.styles);
		}
		var x0=obj.x+(obj.w-obj.w_text)*0.5;
		//desc.m_cached_prt.m_h_text
		UI.ED_RenderRichText(desc.m_cached_prt,desc.m_text,
			x0,obj.y+(obj.h-obj.h_text)*0.5);
		W.Button("prev",{
			x:x0-obj.button_style.w-24,y:obj.y+(obj.h-obj.button_style.h)*0.5,
			w:obj.button_style.w,h:obj.button_style.h,
			style:obj.button_style,text:"<",
			OnClick:function(){
				tip_id--;
				if(tip_id<0){tip_id=UI.m_tips.length-1;}
				UI.m_ui_metadata["<tip_id>"]=tip_id;
				UI.Refresh()
			}
		})
		W.Button("next",{
			x:x0+obj.w_text+24,y:obj.y+(obj.h-obj.button_style.h)*0.5,
			w:obj.button_style.w,h:obj.button_style.h,
			style:obj.button_style,text:">",
			OnClick:function(){
				tip_id++;
				if(tip_id>=UI.m_tips.length){tip_id=0;}
				UI.m_ui_metadata["<tip_id>"]=tip_id;
				UI.Refresh()
			}
		})
	UI.End()
	return obj
}

///////////////////////
UI.m_new_document_search_path=IO.GetNewDocumentName(undefined,undefined,"document");
UI.m_previous_document=undefined
UI.UpdateNewDocumentSearchPath=function(){
	if(!UI.m_the_document_area){return;}
	var active_document=UI.m_the_document_area.active_tab
	if(active_document&&!active_document.file_name){
		active_document=UI.GetFrontMostEditorTab();
	}
	var ret=undefined;
	if(active_document&&active_document.file_name){
		ret=UI.GetPathFromFilename(active_document.file_name)
		UI.m_previous_document=active_document.file_name
	}else{
		ret=IO.GetNewDocumentName(undefined,undefined,"document");
		UI.m_previous_document=undefined
	}
	UI.m_new_document_search_path=ret;
	return ret
}

UI.RefreshAllTabs=function(){
	UI.g_refresh_all_tabs=1;
	UI.Refresh()
};
