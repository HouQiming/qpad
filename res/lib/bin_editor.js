var UI=require("gui2d/ui");
var W=require("gui2d/widgets");
require("res/lib/global_doc");

var TYPE_BYTE=0;
var TYPE_INT=1;
var TYPE_UINT=2;
var TYPE_FLOAT=3;
var TYPE_MASK_BE=16;
var toNodeBuffer=function(a){return Buffer(a.buffer);};
W.BinaryEditor_prototype={
	ResetWBytes:function(w_bytes){
		this.m_w_bytes=w_bytes;
		var addr_lastline=Math.floor(this.m_data.length/w_bytes)*w_bytes;
		var lg=0;
		while(addr_lastline>0){
			addr_lastline=Math.floor(addr_lastline/16);
			lg++;
		}
		this.m_lg_addr=lg;
		this.m_line_number_font=(this.m_lg_addr<=8?this.line_number_font:this.line_number_font_small);
		this.m_w_line_number_char=UI.GetCharacterAdvance(this.m_line_number_font,48);
		this.m_w_addr=Math.min(this.m_lg_addr,8)*this.m_w_line_number_char+16;
		var hc_linenumber=UI.GetCharacterHeight(this.m_line_number_font);
		this.m_h_addr=hc_linenumber+8;
	},
	AutoScroll:function(){
		var n_lines_disp=this.GetNLinesDisp();
		this.m_scroll=Math.min(Math.max(this.m_scroll,this.m_sel1-(n_lines_disp-1)*this.m_w_bytes),this.m_sel1)
		this.ValidateScroll();
	},
	ValidateScroll:function(){
		var n_lines_disp=this.GetNLinesDisp();
		this.m_scroll=Math.max(Math.min(this.m_scroll,this.m_data.length+this.m_w_bytes-1-n_lines_disp*this.m_w_bytes),0);
		this.m_scroll=Math.floor(this.m_scroll/this.m_w_bytes)*this.m_w_bytes;
	},
	FormatAddr:function(addr){
		var ss_addr=["0x"];
		var addr_value=addr;
		for(var j=0;j<this.m_lg_addr;j++){
			var addr2=Math.floor(addr_value/16)
			var ch=addr_value-addr2*16;
			if(ch>=10){
				ch+=65-10;
			}else{
				ch+=48;
			}
			addr_value=addr2;
			ss_addr[this.m_lg_addr-j]=String.fromCharCode(ch);
		}
		return ss_addr.join('')
	},
	ValidateSelection:function(is_shift,validation_dir){
		this.m_sel1=Math.min(Math.max(0,this.m_sel1),this.m_data.length);
		var rg=UI.BIN_GetRangeAt(this,this.m_sel1);
		var sz=1<<(rg.tid&3);
		if(validation_dir<0){
			this.m_sel1=Math.floor((this.m_sel1-rg.ofs)/sz)*sz+rg.ofs;
		}else{
			this.m_sel1=Math.floor((this.m_sel1-rg.ofs+sz-1)/sz)*sz+rg.ofs;
		}
		if(!is_shift){this.m_sel0=this.m_sel1;}
		///////////
		//auto-value
		rg=UI.BIN_GetRangeAt(this,this.m_sel1);
		var did=0;
		if(rg.tid==0){
			var sz=Math.max(this.m_sel0,this.m_sel1)-Math.min(this.m_sel0,this.m_sel1);
			if(sz==2||sz==4||sz==8){
				var addr=Math.min(this.m_sel0,this.m_sel1);
				var final_text=[];
				sz={1:0,2:1,4:2,8:3}[sz];
				var s_i_prev=undefined;
				for(var isbe=0;isbe<2;isbe++){
					final_text.push(UI.Format('"@1" is ',UI.BIN_ReadToString(this,addr,{tid:isbe*16+sz})));
					for(var ttype=1;ttype<4;ttype++){
						var tid=isbe*16+ttype*4+sz;
						var s_i=UI.BIN_ReadToString(this,addr,{tid:tid});
						if(s_i&&(s_i!=s_i_prev||ttype!=2)){
							var s_format="@1 in @2, ";
							if(ttype==3){s_format="or @1 in @2. ";}
							final_text.push(UI.Format(s_format,
								[UI.ED_RichTextCommandChar(UI.RICHTEXT_COMMAND_SET_STYLE+1),
								s_i,
								UI.ED_RichTextCommandChar(UI.RICHTEXT_COMMAND_SET_STYLE+0)].join(''),[g_types[(tid>>2)&3],g_sizes[tid&3].toString()].join('')
							))
						}
						s_i_prev=s_i;
					}
				}
				did=1
				this.CreateNotification('眼',final_text.join(''))
				UI.Refresh()
			}
		}
		if(!did){
			this.CreateNotification('眼',UI._('Address: ')+(this.m_sel0!=this.m_sel1?this.FormatAddr(this.m_sel0)+'-':'')+this.FormatAddr(this.m_sel1))
		}
		this.AutoScroll()
	},
	GetNLinesDisp:function(){
		var hc=UI.GetCharacterHeight(this.font);
		return Math.max(((this.h-this.h_notification_area)/(this.m_main_area_scale_factor||1)-this.m_h_addr)/hc,1)|0;
	},
	StartEdit:function(s,event){
		if(this.m_sel1>=this.m_data.length){return;}
		this.m_sel1=Math.min(this.m_sel0,this.m_sel1);
		this.m_sel0=this.m_sel1;
		this.m_show_edit=1
		this.m_edit_event=[s,event];
		UI.Refresh();
	},
	GetSelectionAsBuffer:function(){
		var addr0=Math.min(this.m_sel0,this.m_sel1);
		var addr1=Math.max(this.m_sel0,this.m_sel1);
		return this.m_data.slice(addr0,addr1)
	},
	OnTextEdit:function(event){
		this.StartEdit("OnTextEdit",event);
	},
	OnTextInput:function(event){
		this.StartEdit("OnTextInput",event);
	},
	OnKeyDown:function(event){
		var is_shift=event.keymod&(UI.KMOD_LSHIFT|UI.KMOD_RSHIFT);
		var IsHotkey=UI.IsHotkey;
		var validation_dir=-1;
		if(0){
		}else if(IsHotkey(event,"UP SHIFT+UP")){
			this.m_sel1-=this.m_w_bytes;
		}else if(IsHotkey(event,"DOWN SHIFT+DOWN")){
			this.m_sel1+=this.m_w_bytes;
		}else if(IsHotkey(event,"CTRL+UP")){
			var n_lines_disp=this.GetNLinesDisp();
			this.m_scroll-=this.m_w_bytes;
			this.ValidateScroll();
			UI.Refresh()
			return
		}else if(IsHotkey(event,"CTRL+DOWN")){
			var n_lines_disp=this.GetNLinesDisp();
			this.m_scroll+=this.m_w_bytes;
			this.ValidateScroll();
			UI.Refresh()
			return
		}else if(IsHotkey(event,"PGUP SHIFT+PGUP")){
			var n_lines_disp=this.GetNLinesDisp();
			this.m_sel1-=this.m_w_bytes*n_lines_disp;
			this.m_scroll-=this.m_w_bytes*n_lines_disp;
		}else if(IsHotkey(event,"PGDN SHIFT+PGDN")){
			var n_lines_disp=this.GetNLinesDisp();
			this.m_sel1+=this.m_w_bytes*n_lines_disp;
			this.m_scroll+=this.m_w_bytes*n_lines_disp;
		}else if(IsHotkey(event,"LEFT SHIFT+LEFT")){
			this.m_sel1--;
		}else if(IsHotkey(event,"RIGHT SHIFT+RIGHT")){
			this.m_sel1++;
			validation_dir=1;
		}else if(IsHotkey(event,"CTRL+LEFT SHIFT+CTRL+LEFT")){
			this.m_sel1-=4;
		}else if(IsHotkey(event,"CTRL+RIGHT SHIFT+CTRL+RIGHT")){
			this.m_sel1+=4;
			validation_dir=1;
		}else if(IsHotkey(event,"HOME SHIFT+HOME")){
			this.m_sel1=Math.floor(this.m_sel1/this.m_w_bytes)*this.m_w_bytes;
		}else if(IsHotkey(event,"END SHIFT+END")){
			this.m_sel1=Math.floor(this.m_sel1/this.m_w_bytes)*this.m_w_bytes+this.m_w_bytes-1;
		}else if(IsHotkey(event,"CTRL+HOME SHIFT+CTRL+HOME")){
			this.m_sel1=0;
		}else if(IsHotkey(event,"CTRL+A")){
			this.m_sel0=0;
			this.m_sel1=this.m_data.length;
			this.ValidateSelection(1,validation_dir);
			UI.Refresh()
			return;
		}else if(IsHotkey(event,"CTRL+END SHIFT+CTRL+END")){
			this.m_sel1=this.m_data.length;
		}else if(IsHotkey(event,"CTRL+Z")||IsHotkey(event,"ALT+BACKSPACE")){
			this.Undo()
			return;
		}else if(IsHotkey(event,"SHIFT+CTRL+Z")||IsHotkey(event,"CTRL+Y")){
			this.Redo()
			return;
		}else if(IsHotkey(event,"CTRL+G")){
			UI.OpenUtilTab("binary_tools");
			if(this.goto_bar_edit){
				UI.SetFocus(this.goto_bar_edit)
			}else{
				UI.NextTick(function(){
					if(this.goto_bar_edit){
						UI.SetFocus(this.goto_bar_edit)
					}
				}.bind(this))
			}
			UI.Refresh()
			return;
		}else if(IsHotkey(event,"CTRL+C")){
			this.Copy()
			return;
		//}else if(IsHotkey(event,"CTRL+F")){
		//	this.m_show_find=!this.m_show_find;
		//	UI.Refresh()
		//	return;
		//}else if(this.m_last_needle&&IsHotkey(event,"F3")){
		//	this.FindNext(this.m_sel1,1,this.m_last_needle)
		//}else if(this.m_last_needle&&IsHotkey(event,"SHIFT+F3")){
		//	this.FindNext(this.m_sel1,-1,this.m_last_needle)
		//}else if(IsHotkey(event,"CTRL+F3")){
		//	this.FindNext(this.m_sel1,1,new Uint8Array(this.GetSelectionAsBuffer()))
		//}else if(IsHotkey(event,"SHIFT+CTRL+F3")){
		//	this.FindNext(this.m_sel1,-1,new Uint8Array(this.GetSelectionAsBuffer()))
		}else if(IsHotkey(event,"CTRL+V")){
			this.StartEdit("OnKeyDown",event);
		}else if(IsHotkey(event,"ESC")){
			this.m_last_needle=undefined;
			this.DismissNotification()
		}else{
			return;
		}
		this.ValidateSelection(is_shift,validation_dir);
		UI.Refresh()
	},
	MapMouseToAddr:function(event,rgid){
		var hc=UI.GetCharacterHeight(this.font);
		var w_digit=UI.GetCharacterAdvance(this.font,48);
		var w_text_char=w_digit*0.625;
		var w_space1=w_digit*0.75;
		var w_space4=w_digit*0.25;
		var w_space8=w_digit*0.25;
		var mapXLeft=function(daddr_x){
			return w_digit*2*daddr_x+w_space1*(daddr_x)+w_space4*(daddr_x>>2)+w_space8*(daddr_x>>3);
		};
		var daddr_y=Math.floor((event.y-((this.m_main_area_scale_factor!=1?0:this.y)+this.m_h_addr))/hc);
		var daddr_x=0;
		if(rgid=="rgn_text"){
			daddr_x=Math.floor((event.x-this.m_x_text)/w_text_char);
		}else{
			daddr_x=0;
			for(var x=0;x<this.m_w_bytes;x++){
				if(this.m_x_main+mapXLeft(x)<event.x){
					daddr_x=x;
				}else{
					break;
				}
			}
			if(this.m_x_main+mapXLeft(this.m_w_bytes-1)+w_digit*2<event.x){
				daddr_x=this.m_w_bytes;
			}
		}
		return this.m_scroll+daddr_y*this.m_w_bytes+daddr_x;
	},
	OnMouseDown:function(event,rgid){
		if(this.is_preview){return;}
		UI.SetFocus(this)
		if(!rgid){return;}
		if(rgid=="rgn_minimap"){
			//minimap scrolling, pgup / pgdn / *the-thing*
			if(event.y>=this.m_minimap_page_y0&&event.y<=this.m_minimap_page_y1){
				//the knob
				this.is_dragging=rgid;
				this.drag_y0=event.y;
				this.drag_value0=this.m_scroll;
			}else if(event.y<this.m_minimap_page_y0){
				//pgup
				var n_lines_disp=this.GetNLinesDisp();
				this.m_scroll-=this.m_w_bytes*n_lines_disp;
				this.ValidateScroll()
				UI.Refresh()
			}else{
				//pgdn
				var n_lines_disp=this.GetNLinesDisp();
				this.m_scroll+=this.m_w_bytes*n_lines_disp;
				this.ValidateScroll()
				UI.Refresh()
			}
		}else{
			//text selection
			this.m_sel1=this.MapMouseToAddr(event,rgid);
			if(!UI.IsPressed("LSHIFT")&&!UI.IsPressed("RSHIFT")){
				this.dragging_shift=0;
			}else{
				this.dragging_shift=1;
			}
			this.ValidateSelection(this.dragging_shift,-1)
			if(event.clicks==2){
				//double-click
				this.m_sel1=Math.floor(this.m_sel1/4)*4;
				this.ValidateSelection(0,-1)
				//non-shift updates sel0, now update sel1 again
				this.m_sel1+=4;
				this.ValidateSelection(1,1)
				this.dragging_shift=0;
			}else if(event.clicks>=3){
				//triple-click
				this.m_sel1=Math.floor(this.m_sel1/this.m_w_bytes)*this.m_w_bytes;
				this.ValidateSelection(0,-1)
				//non-shift updates sel0, now update sel1 again
				this.m_sel1+=this.m_w_bytes;
				this.ValidateSelection(1,1)
				this.dragging_shift=0;
			}
			this.is_dragging=rgid;
			this.drag_value0=this.m_sel0;
			this.drag_value1=this.m_sel1;
			UI.Refresh()
		}
	},
	OnMouseMove:function(event,rgid){
		if(!this.is_dragging){return;}
		if(this.is_dragging=="rgn_minimap"){
			var h_scrollable=Math.max(this.m_h_minimap-(this.m_minimap_page_y1-this.m_minimap_page_y0),1);
			this.m_scroll=Math.floor(this.drag_value0+(event.y-this.drag_y0)/h_scrollable*this.m_scroll_max);
			this.ValidateScroll();
			UI.Refresh()
		}else{
			var mouse_sel=this.MapMouseToAddr(event,this.is_dragging);
			if(!this.dragging_shift&&mouse_sel>=this.drag_value0&&mouse_sel<=this.drag_value1){
				this.m_sel0=this.drag_value0;
				this.m_sel1=this.drag_value1;
			}else{
				if(!this.dragging_shift){
					if(mouse_sel<this.drag_value0){
						this.m_sel0=this.drag_value1;
					}else{
						this.m_sel0=this.drag_value0;
					}
				}
				this.m_sel1=mouse_sel;
			}
			this.ValidateSelection(1,-1)
			this.AutoScroll()
			UI.Refresh()
		}
	},
	OnMouseUp:function(event,rgid){
		this.OnMouseMove(event,rgid);
		this.is_dragging=undefined;
	},
	OnMouseWheel:function(event,rgid){
		this.m_scroll-=this.m_w_bytes*event.y*this.mouse_wheel_speed;
		this.ValidateScroll();
		UI.Refresh()
	},
	SaveMetaData:function(){
		if(this.is_preview){return;}
		var new_metadata=(UI.m_ui_metadata[this.file_name]||{});
		new_metadata.sel0=this.m_sel0;
		new_metadata.sel1=this.m_sel1;
		new_metadata.ranges=this.m_ranges;
		new_metadata.bookmarks=this.m_bookmarks;
		new_metadata.w_bytes=this.m_w_bytes;
		new_metadata.m_scroll=this.m_scroll;
		if(!new_metadata.m_language_id){
			new_metadata.m_language_id='Binary';
		}
		UI.m_ui_metadata[this.file_name]=new_metadata
	},
	PushUndo:function(addr,sz){
		//change tracking / rendering / undo / redo
		sz=Math.min(sz,this.m_data.length-addr);
		var buf=new Buffer(this.m_data.slice(addr,addr+sz));
		if(this.m_undo_queue.length<this.saved_point){
			this.saved_point=-1;
			this.m_redo_queue=[];
		}
		this.m_undo_queue.push({addr:addr,buf:buf});
		//this.SetRange(addr,addr+sz,{color:this.color_edited});
	},
	UndoImpl:function(undo_queue,redo_queue){
		if(!undo_queue.length){return 0;}
		var item=undo_queue.pop();
		var addr=item.addr;
		var sz=item.buf.length;
		var buf=new Buffer(this.m_data.slice(addr,addr+sz));
		redo_queue.push({addr:addr,buf:buf});
		item.buf.copy(this.m_data,addr);
		this.m_sel0=addr
		this.m_sel1=addr
		UI.Refresh()
		return 1;
	},
	Undo:function(){
		return this.UndoImpl(this.m_undo_queue,this.m_redo_queue)
	},
	Redo:function(){
		return this.UndoImpl(this.m_redo_queue,this.m_undo_queue)
	},
	Copy:function(){
		var addr0=Math.min(this.m_sel0,this.m_sel1);
		var addr1=Math.max(this.m_sel0,this.m_sel1);
		if(addr0<addr1){
			UI.SDL_SetClipboardText(UI.BIN_BufToString(this.m_data.slice(addr0,addr1)))
		}
	},
	Save:function(){
		if(this.m_file_name_mapped=="<failed>"){return;}
		var arr=[];
		for(var i=0;i<this.m_undo_queue.length;i++){
			var item=this.m_undo_queue[i];
			arr[i*2+0]=item.addr;
			arr[i*2+1]=item.addr+item.buf.length;
		}
		for(var i=0;i<this.m_redo_queue.length;i++){
			var item=this.m_redo_queue[i];
			arr[i*2+0]=item.addr;
			arr[i*2+1]=item.addr+item.buf.length;
		}
		if(!UI.BIN_Save(this,arr,this.file_name,this.file_name==this.m_file_name_mapped)){
			return;
		}
		this.m_data_raw=undefined;
		this.m_data=undefined;
		this.m_data_raw=UI.BIN_MapCopyOnWrite(this.file_name);
		this.m_data=toNodeBuffer((this.m_data_raw));
		this.m_file_name_mapped=this.file_name;
		////////////
		this.saved_point=this.m_undo_queue.length
		this.SaveMetaData();
		UI.SaveMetaData();
	},
	GetRangeFromSelection:function(){
		var sel0=this.m_sel0;
		var sel1=this.m_sel1;
		if(sel0>sel1){
			var tmp=sel0;
			sel0=sel1;
			sel1=tmp;
		}
		var rg=UI.BIN_GetRangeAt(this,Math.min(this.m_sel0,this.m_sel1));
		if(sel0==sel1&&rg.ofs<=sel0&&sel1<=rg.ofs+rg.size){
			sel0=rg.ofs;
			sel1=rg.ofs+rg.size;
		}else{
			//non-region area, ignore it
		}
		return [sel0,sel1];
	},
	SetRange:function(sel0,sel1,rg_template){
		var rg_ref=UI.BIN_GetRangeAt(this,Math.min(sel0,sel1));
		var ranges=this.m_ranges;
		var ranges2=[];
		var add_sel=1;
		if((rg_template.color==undefined||((rg_template.color^this.text_color)&0xffffff)==0)&&(rg_template.tid==undefined||rg_template.tid==0)){
			//it's effective canceling
			add_sel=0;
		}
		for(var i=0;i<ranges.length;i++){
			var rg=ranges[i];
			var rgofs0=rg.ofs;
			var rgofs1=rg.ofs+rg.size;
			if(sel0<rgofs1&&rgofs0<sel0){
				//generate part 0
				ranges2.push({color:rg.color,tid:rg.tid,ofs:rgofs0,size:sel0-rgofs0});
				rgofs0=sel1;
			}
			if(rgofs0<rgofs1&&sel1<rgofs1&&rgofs0<sel1){
				//generate part 1
				ranges2.push({color:rg.color,tid:rg.tid,ofs:sel1,size:rgofs1-sel1});
				rgofs1=sel0;
			}
			if(rgofs0<rgofs1){
				//keep the original range
				if(rgofs0==sel0&&rgofs1==sel1&&add_sel){
					//exactly the same thing case, override
					if(rg_template.color!=undefined){
						rg.color=rg_template.color;
					}
					if(rg_template.tid!=undefined){
						rg.tid=rg_template.tid;
					}
					add_sel=0;
				}else if(rgofs0>=sel0&&rgofs1<=sel1){
					//all-in case, remove it
					continue;
				}
				rg.ofs=rgofs0;
				rg.size=rgofs1-rgofs0;
				ranges2.push(rg);
			}
		}
		if(add_sel){
			ranges2.push({color:rg_template.color||rg_ref.color,tid:rg_template.tid||rg_ref.tid,ofs:sel0,size:sel1-sel0})
		}
		this.m_ranges=ranges2;
		this.m_native_view=UI.BIN_CreateView(this.m_ranges);
		UI.Refresh()
	},
	CreateNotification:function(icon,text){
		this.m_notification={icon:icon,text:UI._(text)};
		UI.Refresh()
	},
	DismissNotification:function(){
		this.m_notification=undefined;
		UI.Refresh()
	},
	FindNext:function(addr,dir,buf_needle){
		if(!buf_needle||!buf_needle.length){return;}
		this.m_find_context={
			m_needle:buf_needle,
			m_needle_prt:UI.BIN_PreprocessNeedle(buf_needle,dir),
			m_addr:addr,
			m_dir:dir,
		};
		this.m_last_needle=buf_needle;
		UI.Refresh()
	},
	ToggleBookmark:function(id){
		for(var i=0;i<this.m_bookmarks.length;i++){
			var bm=this.m_bookmarks[i];
			if(!bm){continue;}
			if(bm.addr==this.m_sel1||id!=undefined&&bm.id==id){
				//remove the bookmark instead of setting a new one
				this.m_bookmarks[i]=this.m_bookmarks[this.m_bookmarks.length-1];
				this.m_bookmarks.pop();
				if(bm.addr==this.m_sel1){
					UI.Refresh();
					return;
				}
			}
		}
		this.m_bookmarks.push({addr:this.m_sel1,id:id});
		UI.Refresh();
	},
	GetNextBookmark:function(addr,direction){
		var best=undefined,best_bm=undefined;
		for(var i=0;i<this.m_bookmarks.length;i++){
			var bm=this.m_bookmarks[i];
			if(!bm){continue;}
			var dist=(bm.addr-addr)*direction;
			if(dist>0&&!(best<dist)){
				best=dist;
				best_bm=bm;
			}
		}
		return best_bm&&best_bm.addr;
	},
	GotoNextBookmark:function(direction,is_sel){
		var addr_new=this.GetNextBookmark(this.m_sel1,direction);
		if(addr_new==undefined){return;}
		if(!is_sel){
			this.m_sel0=addr_new;
		}
		this.m_sel1=addr_new;
		this.ValidateSelection(0,-1)
		this.AutoScroll()
		UI.Refresh()
	},
	OnDestroy:function(){
		this.m_data_raw=new Buffer(0);
		this.m_data=toNodeBuffer((this.m_data_raw));
		Duktape.gc();
	},
};

W.SlaveRegion_prototype={
	OnMouseDown:function(event){UI.CaptureMouse(this);this.owner.OnMouseDown(event,this.__id);},
	OnMouseMove:function(event){this.owner.OnMouseMove(event,this.__id);},
	OnMouseUp:function(event){this.owner.OnMouseUp(event,this.__id);UI.ReleaseMouse(this);},
	OnMouseWheel:function(event){this.owner.OnMouseWheel(event,this.__id);},
};

var g_types=['b','i','u','f'];
var g_sizes=[8,16,32,64];
W.BinaryEditor=function(id,attrs){
	//could do the main view in pure JS... minimap is a different story though
	//	the duktape f32/f64 <-> text code is more precise
	//	to-text doesn't have to be - we have a width budget anyway
	//any complicated edit could be performed in the parser script
	var obj=UI.StdWidget(id,attrs,"binary_editor",W.BinaryEditor_prototype);
	var w_digit=UI.GetCharacterAdvance(obj.font,48)
	var w_text_char=w_digit*0.625;
	var w_space1=w_digit*0.75;
	var w_space4=w_digit*0.25;
	var w_space8=w_digit*0.25;
	var mapX=function(daddr_x){
		return w_digit*2*(daddr_x+1)+w_space1*(daddr_x)+w_space4*(daddr_x>>2)+w_space8*(daddr_x>>3);
	};
	var XYFromCcnt=function(pos){
		var daddr=pos-obj.m_scroll;
		var daddr_y=(daddr/obj.m_w_bytes)|0;
		var daddr_x=daddr-daddr_y*obj.m_w_bytes;
		return {x:mapX(daddr_x)-w_digit*2,y:daddr_y};
	};
	var XYFromCcntText=function(pos){
		var daddr=pos-obj.m_scroll;
		var daddr_y=(daddr/obj.m_w_bytes)|0;
		var daddr_x=daddr-daddr_y*obj.m_w_bytes;
		return {x:mapX(obj.m_w_bytes)-w_digit*2+w_text_char*daddr_x,y:daddr_y};
	};
	var y_main_area=obj.y;
	var h_main_area=obj.h;
	y_main_area+=obj.h_notification_area;
	h_main_area-=obj.h_notification_area;
	if(!obj.m_find_context){
		W.PureRegion(id,obj);
	}
	UI.Begin(obj)
	//draw the notification
	UI.RoundRect({
		x:obj.x,y:obj.y,w:obj.w,h:obj.h_notification_area,
		color:obj.notification_bgcolor,
	})
	if(obj.m_find_context){
		W.Text("",{
			x:obj.x+4,y:obj.y+(obj.h_notification_area-UI.GetCharacterHeight(obj.notification_icon_font))*0.5,
			font:obj.notification_icon_font,text:'s',color:obj.notification_text_color,
		})
		var ctx=obj.m_find_context;
		W.Text("",{
			x:obj.x+28,y:obj.y+(obj.h_notification_area-UI.GetCharacterHeight(obj.notification_styles[0].font))*0.5,
			font:obj.notification_styles[0].font,text:UI._("Searching ..."),color:obj.notification_styles[0].color,
		})
		//1048576 is the budget
		var ret=UI.BIN_SearchBuffer(obj.m_data,ctx.m_addr,ctx.m_dir, ctx.m_needle,ctx.m_needle_prt, 1048576);
		if(ret==undefined||ret.found){
			obj.m_find_context=undefined;
			if(ret&&ret.found){
				obj.m_sel0=ret.addr;
				obj.m_sel1=ret.addr+ctx.m_dir*ctx.m_needle.length;
				obj.ValidateSelection(1,-1)
				obj.AutoScroll()
				obj.CreateNotification('s',UI._('Found one'))
			}else{
				obj.CreateNotification('s',UI._(ctx.m_dir<0?'No more matches above':'No more matches below'))
			}
		}else{
			ctx.m_addr=ret.addr;
		}
		//have to refresh to "search next"
		UI.Refresh()
	}else if(obj.m_show_find){
		W.Text("",{
			x:obj.x+4,y:obj.y+(obj.h_notification_area-UI.GetCharacterHeight(obj.notification_icon_font))*0.5,
			font:obj.notification_icon_font,text:'s',color:obj.notification_text_color,
		})
		var hc_fb_editing=UI.GetCharacterHeight(obj.find_bar_font);
		var had_edit=!!obj.findbar_edit;
		W.Edit("findbar_edit",{
			x:obj.x+28,y:obj.y+(obj.h_notification_area-hc_fb_editing)*0.5,
			w:obj.w-32,h:hc_fb_editing,
			font:obj.find_bar_font, text:UI.m_ui_metadata["<find_state>"].m_binary_needle||"",
			is_single_line:1,right_side_autoscroll_margin:0.5,
			precise_ctrl_lr_stop:UI.TestOption("precise_ctrl_lr_stop"),
			same_line_only_left_right:!UI.TestOption("left_right_line_wrap"),
			owner:obj,
			additional_hotkeys:[{key:"ESCAPE",action:function(){
				//cancel the change
				var obj=this.owner
				obj.m_show_find=0;
				UI.Refresh()
			}}],
			OnBlur:function(){
				var obj=this.owner
				obj.m_show_find=0;
				UI.Refresh()
			},
			OnEnter:function(){
				//apply the change - binary patch / undo queue
				var obj=this.owner
				obj.m_show_find=0;
				var ret;
				var stext_raw=this.ed.GetText();
				UI.m_ui_metadata["<find_state>"].m_binary_needle=stext_raw;
				obj.DismissNotification()
				try{
					ret=JSON.parse(Duktape.__eval_expr_sandbox(stext_raw))
				}catch(e){
					obj.CreateNotification('错',UI.ED_RichTextCommandChar(UI.RICHTEXT_COMMAND_SET_STYLE+2)+UI._("Bad search expression: ")+e.message)
					UI.Refresh()
					return;
				}
				if(Array.isArray(ret)){
					ret=new Uint8Array(ret);
				}
				if(!(UI.BIN_isBuffer(ret)||!this.tid&&(typeof ret)=='string')){
					obj.CreateNotification('错',UI.ED_RichTextCommandChar(UI.RICHTEXT_COMMAND_SET_STYLE+2)+UI._("The search expression has to be a string or a buffer"))
					UI.Refresh()
					return;
				}
				var buf_str=new Buffer(ret);
				obj.FindNext(obj.m_sel1,1,buf_str)
				UI.SetFocus(obj)
				UI.Refresh()
			},
		});
		if(!obj.findbar_edit.ed.GetTextSize()){
			W.Text("",{
				x:obj.x+28,y:obj.y+(obj.h_notification_area-UI.GetCharacterHeight(obj.notification_styles[0].font))*0.5,
				font:obj.notification_styles[0].font,text:UI._("Search a JS expression, e.g. 'MZ' or [0x4d,0x5a]"),color:obj.notification_styles[0].color&0x7fffffff,
			})
		}
		if(!had_edit){
			UI.SetFocus(obj.findbar_edit)
			obj.findbar_edit.SetSelection(0,obj.findbar_edit.ed.GetTextSize())
			UI.Refresh()
		}
	}else if(obj.m_notification){
		W.Text("",{
			x:obj.x+4,y:obj.y+(obj.h_notification_area-UI.GetCharacterHeight(obj.notification_icon_font))*0.5,
			font:obj.notification_icon_font,text:obj.m_notification.icon,color:obj.notification_text_color,
		})
		var prt=UI.ED_FormatRichText(
			Language.GetHyphenator(UI.m_ui_language),
			obj.m_notification.text,4,1e9,obj.notification_styles);
		UI.ED_RenderRichText(prt,obj.m_notification.text,
			obj.x+28,obj.y+(obj.h_notification_area-UI.GetCharacterHeight(obj.notification_styles[0].font))*0.5)
		//W.Text("",{
		//	x:obj.x+28,y:obj.y+(obj.h_notification_area-UI.GetCharacterHeight(obj.notification_font))*0.5,
		//	font:obj.notification_font,text:obj.m_notification.text,color:obj.notification_icon_color,
		//})
	}
	UI.PushCliprect(obj.x,y_main_area,obj.w,h_main_area)
		if(!obj.m_data){
			//init
			var loaded_metadata=(UI.m_ui_metadata[obj.file_name]||{});
			obj.m_data_raw=UI.BIN_MapCopyOnWrite(obj.file_name);//we need to keep a reference
			if(!obj.m_data_raw){
				obj.m_data_raw=new Buffer(0)
				obj.m_file_name_mapped="<failed>";
			}else{
				obj.m_file_name_mapped=obj.file_name;
			}
			obj.m_data=toNodeBuffer((obj.m_data_raw));
			if(!loaded_metadata.ranges){
				//coulddo: default parsing script
			}
			obj.m_ranges=(loaded_metadata.ranges||[]);
			obj.m_bookmarks=(loaded_metadata.bookmarks||[]);
			obj.m_native_view=UI.BIN_CreateView(obj.m_ranges);
			obj.m_scroll=(loaded_metadata.m_scroll||0);
			obj.m_sel0=(loaded_metadata.sel0||0);
			obj.m_sel1=(loaded_metadata.sel1||0);
			obj.m_ramp=new Int32Array(256);
			obj.ResetWBytes(loaded_metadata.w_bytes||32);
			obj.ValidateSelection(0,-1)
			obj.AutoScroll()
			//default ramp
			for(var i=0;i<256;i++){
				var hr=1,hg=1,hb=1;
				if(i<0x20){
					//control
					if(i==10||i==13||i==9){
						hr=0.6;hg=0.6;hb=1.0
					}else if(i!=0){
						hr=1.;hg=0.4;hb=0.4;
					}
				}else if(i<0x7f){
					//printable
					hr=0.6;hg=0.6;hb=1.0;
				}else{
					if(i!=0xff&&i!=0xcc){
						//high
						hr=0.6;hg=1.0;hb=0.6;
					}
				}
				var L=(i&0x1f)*((255-64)/31.0)+32;
				var L0=L/(0.3*hr+0.59*hg+0.11*hb);
				var R=Math.min(Math.floor(hr*L0+0.5),255);
				var G=Math.min(Math.floor(hg*L0+0.5),255);
				var B=Math.min(Math.floor(hb*L0+0.5),255);
				var Ldelta=L-(0.3*(R)+0.59*(G)+0.11*(B));
				if(Ldelta>1.0&&R<255){
					R=Math.min(R+Math.max(Math.floor(Ldelta/0.3),1),255)
					Ldelta=L-(0.3*(R)+0.59*(G)+0.11*(B));
				}
				if(Ldelta>1.0&&G<255){
					G=Math.min(G+Math.max(Math.floor(Ldelta/0.59),1),255)
					Ldelta=L-(0.3*(R)+0.59*(G)+0.11*(B));
				}
				if(Ldelta>1.0&&B<255){
					B=Math.min(B+Math.max(Math.floor(Ldelta/0.11),1),255)
					Ldelta=L-(0.3*(R)+0.59*(G)+0.11*(B));
				}
				//bih0.palette[i]=u32(i*0x010101)
				obj.m_ramp[i]=(((B|0)+(G|0)*256+(R|0)*65536))|0xff000000;
			}
			obj.m_undo_queue=[];
			obj.m_redo_queue=[];
			UI.BumpHistory(obj.file_name)
		}
		////////////////////////////
		if(obj.m_file_name_mapped=="<failed>"){
			UI.RoundRect({x:obj.x,y:y_main_area,w:obj.w,h:h_main_area,color:obj.bgcolor})
			W.Text("",{
				anchor:'parent',anchor_align:'center',anchor_valign:'center',
				x:0,y:0,
				font:obj.font_error,
				text:"Failed to load this binary file",
				color:obj.error_color,
			})
		}else{
			var hc=UI.GetCharacterHeight(obj.font);
			var n_lines_disp=obj.GetNLinesDisp();
			var lg=obj.m_lg_addr;
			var y_linenumber0;
			var hc_linenumber=UI.GetCharacterHeight(obj.m_line_number_font);
			if(lg<=8){
				y_linenumber0=(hc-hc_linenumber)*0.5
			}else{
				y_linenumber0=(hc*0.5)
			}
			var rg=UI.BIN_GetRangeAt(obj,Math.min(obj.m_sel0,obj.m_sel1));
			//line numbers
			var dx_text=mapX(obj.m_w_bytes)-w_digit*2;
			var x_minimap_min=obj.x+obj.m_w_addr+dx_text+w_text_char*obj.m_w_bytes;
			//var x_minimap=x_minimap_min;
			var w_minimap=obj.m_w_bytes/UI.pixels_per_unit;
			//var x_panel=obj.x+obj.w-(obj.is_preview?0:obj.w_panel);
			//var x_minimap=x_panel-(w_minimap+obj.minimap_padding*1.5+obj.sxs_shadow_size*0.5);
			var x_minimap=obj.x+obj.w-(w_minimap+obj.minimap_padding*1.5);
			var main_area_scale_factor=1;
			if(x_minimap_min>x_minimap){
				main_area_scale_factor=x_minimap/x_minimap_min;
			}
			obj.m_main_area_scale_factor=main_area_scale_factor;
			UI.RoundRect({x:obj.x,y:y_main_area,w:obj.w,h:h_main_area,color:obj.bgcolor})
			var bk_y_main_area=y_main_area;
			var bk_h_main_area=h_main_area;
			if(main_area_scale_factor!=1){
				UI.PushSubWindow(obj.x,y_main_area,x_minimap-obj.x,h_main_area,main_area_scale_factor);
				y_main_area=0;
				h_main_area/=main_area_scale_factor;
			}
			UI.RoundRect({x:obj.x,y:y_main_area,w:obj.m_w_addr-4,h:h_main_area,color:obj.line_number_bgcolor})
			UI.RoundRect({x:obj.x,y:y_main_area,w:(x_minimap+obj.minimap_padding*0.5-obj.x)/main_area_scale_factor,h:obj.m_h_addr,color:obj.line_number_bgcolor})
			y_linenumber0+=y_main_area;
			var daddr=obj.m_sel1-obj.m_scroll;
			var daddr_y=(daddr/obj.m_w_bytes)|0;
			var daddr_x=daddr-daddr_y*obj.m_w_bytes;
			for(var i=0;i<obj.m_w_bytes;i++){
				var addr_value=i;
				var x_linenumber=obj.x+obj.m_w_addr+mapX(i);
				var C=(i==daddr_x?obj.line_number_color_focus:obj.line_number_color);
				for(var j=0;j<2;j++){
					var addr2=Math.floor(addr_value/16)
					var ch=addr_value-addr2*16;
					if(ch>=10){
						ch+=65-10;
					}else{
						ch+=48;
					}
					addr_value=addr2;
					x_linenumber-=obj.m_w_line_number_char;
					UI.DrawChar(obj.m_line_number_font,x_linenumber,y_main_area+4,C,ch);
				}
			}
			for(var i=0;i<=n_lines_disp;i++){
				var x_linenumber=obj.x+obj.m_w_addr-8;
				var addr_value=obj.m_scroll+i*obj.m_w_bytes;
				var C=(i==daddr_y?obj.line_number_color_focus:obj.line_number_color);
				for(var j=0;j<lg&&j<8;j++){
					var addr2=Math.floor(addr_value/16)
					var ch=addr_value-addr2*16;
					if(ch>=10){
						ch+=65-10;
					}else{
						ch+=48;
					}
					addr_value=addr2;
					x_linenumber-=obj.m_w_line_number_char;
					UI.DrawChar(obj.m_line_number_font,x_linenumber,y_linenumber0+i*hc+obj.m_h_addr,C,ch);
				}
				if(lg>8){
					x_linenumber=obj.x+obj.m_w_addr-8;
					for(var j=0;j<8;j++){
						var addr2=Math.floor(addr_value/16)
						var ch=addr_value-addr2*16;
						if(ch>=10){
							ch+=65-10;
						}else{
							ch+=48;
						}
						addr_value=addr2;
						x_linenumber-=obj.m_w_line_number_char;
						UI.DrawChar(obj.m_line_number_font,x_linenumber,y_linenumber0+i*hc+8,C,ch);
					}
				}
			}
			//draw edit history - we won't be editing much
			var Q=obj.m_undo_queue;
			var phead=(obj.saved_point||0);
			if(phead<0){phead=0;}
			if(phead>Q.length){
				Q=obj.m_redo_queue;
				phead=Math.max(Q.length-(phead-obj.m_undo_queue.length),0);
			}
			var x_main=obj.x+obj.m_w_addr;
			var y_main=y_main_area+obj.m_h_addr;
			for(var i=phead;i<Q.length;i++){
				var item=Q[i];
				var xy0=XYFromCcnt(item.addr);
				if(xy0.y<0||xy0.y>h_main_area){continue;}
				var xy1=XYFromCcnt(item.addr+item.buf.length-1);
				if(xy1.y>xy0.y){
					xy1.x=dx_text;
				}else{
					xy1.x+=w_digit*2;
				}
				UI.RoundRect({x:x_main+xy0.x-obj.edit_rect_blur,y:y_main+xy0.y*hc,w:xy1.x-xy0.x+obj.edit_rect_blur*2,h:hc,
					round:obj.edit_rect_blur,border_width:-obj.edit_rect_blur,
					color:obj.edit_rect_color})
			}
			//draw cursor highlighting
			var caret_xy=XYFromCcnt(obj.m_sel1);
			var caret_r_xy=XYFromCcnt(obj.m_sel1+(1<<(rg.tid&3))-1);
			if(caret_r_xy.y>caret_xy.y){
				caret_r_xy.x=dx_text;
			}else{
				caret_r_xy.x+=2*w_digit;
			}
			if(UI.TestOption("show_line_highlight")){
				UI.RoundRect({
					x:obj.x+obj.m_w_addr+caret_xy.x,
					y:y_main_area+obj.m_h_addr,
					w:caret_r_xy.x-caret_xy.x,
					h:h_main_area-obj.m_h_addr,
					color:obj.color_cur_line_highlight
				})
				UI.RoundRect({
					x:obj.x+obj.m_w_addr,
					y:y_main_area+obj.m_h_addr+caret_xy.y*hc,
					w:obj.w-obj.m_w_addr,
					h:hc,
					color:obj.color_cur_line_highlight
				})
				var t_caret_xy=XYFromCcntText(obj.m_sel1);
				var t_caret_r_xy=XYFromCcntText(obj.m_sel1+(1<<(rg.tid&3))-1);
				if(t_caret_r_xy.y>t_caret_xy.y){
					t_caret_r_xy.x=dx_text+w_text_char*obj.m_w_bytes;
				}else{
					t_caret_r_xy.x+=w_text_char;
				}
				UI.RoundRect({
					x:obj.x+obj.m_w_addr+t_caret_xy.x,
					y:y_main_area+obj.m_h_addr,
					w:t_caret_r_xy.x-t_caret_xy.x,
					h:h_main_area-obj.m_h_addr,
					color:obj.color_cur_line_highlight
				})
			}
			//draw selection
			if(obj.m_sel0!=obj.m_sel1){
				var xy0=XYFromCcnt(Math.min(obj.m_sel0,obj.m_sel1));
				var xy1=XYFromCcnt(Math.max(obj.m_sel0,obj.m_sel1));
				var fDrawSel=function(x_left,x_right){
					if(xy0.y<0){xy0.y=0;xy0.x=x_left;}
					if(xy1.y>n_lines_disp){xy1.y=n_lines_disp;xy1.x=x_right;}
					for(var i=xy0.y;i<=xy1.y;i++){
						var x0=(i==xy0.y?xy0.x:x_left);
						var x1=(i==xy1.y?xy1.x:x_right);
						UI.RoundRect({
							x:obj.x+obj.m_w_addr+x0,
							y:y_main_area+obj.m_h_addr+i*hc,
							w:x1-x0,
							h:hc,
							color:obj.bgcolor_selection
						})
					}
				}
				fDrawSel(0,mapX(obj.m_w_bytes-1));
				xy0=XYFromCcntText(Math.min(obj.m_sel0,obj.m_sel1));
				xy1=XYFromCcntText(Math.max(obj.m_sel0,obj.m_sel1));
				fDrawSel(dx_text,dx_text+w_text_char*obj.m_w_bytes);
			}
			//draw bookmarks
			for(var i=0;i<obj.m_bookmarks.length;i++){
				var bm_i=obj.m_bookmarks[i];
				var xy0=XYFromCcnt(bm_i.addr);
				//draw a bar
				UI.RoundRect({
					x:obj.x+obj.m_w_addr+xy0.x-4,
					y:y_main_area+obj.m_h_addr+xy0.y*hc-2,
					w:2,h:hc+4,color:obj.bookmark_border_color})
				if(bm_i.id){
					//draw a number
					UI.DrawChar(obj.bookmark_font,
						obj.x+obj.m_w_addr+xy0.x-10,
						y_main_area+obj.m_h_addr+xy0.y*hc-4,
						obj.bookmark_text_color,48+bm_i.id);
				}
			}
			//draw the actual text
			UI.BIN_Render(obj.x+obj.m_w_addr,y_main_area+obj.m_h_addr,undefined,h_main_area-obj.m_h_addr,obj,obj.m_scroll)
			//main-area mouse regions
			obj.m_x_main=obj.x+obj.m_w_addr;
			obj.m_x_text=obj.x+obj.m_w_addr+dx_text;
			W.Region("rgn_main",{owner:obj,x:obj.m_x_main,y:y_main_area+obj.m_h_addr,w:dx_text,h:h_main_area-obj.m_h_addr},W.SlaveRegion_prototype)
			W.Region("rgn_text",{owner:obj,x:obj.m_x_text,y:y_main_area+obj.m_h_addr,w:w_digit*obj.m_w_bytes,h:h_main_area-obj.m_h_addr},W.SlaveRegion_prototype)
			///////////////
			var x_caret=obj.x+obj.m_w_addr+caret_xy.x;
			var y_caret=y_main_area+obj.m_h_addr+caret_xy.y*hc;
			if(obj.m_show_edit){
				//edit box at caret
				x_caret_r=obj.x+obj.m_w_addr+caret_r_xy.x;
				var s_text="";
				if(obj.m_edit_event){
					s_text=UI.BIN_ReadToString(obj,obj.m_sel1);
					if(((rg.tid>>2)&3)==TYPE_BYTE){
						s_text="0x"+s_text;
					}
				}
				UI.RoundRect({
					x:x_caret-obj.edit_padding-obj.edit_shadow_size-obj.edit_border_width,y:y_caret,
					w:Math.max(x_caret_r-x_caret,obj.w_edit)+(obj.edit_padding+obj.edit_shadow_size+obj.edit_border_width)*2,h:hc+obj.edit_shadow_size,
					color:obj.edit_shadow_color,border_width:-obj.edit_shadow_size,
					round:obj.edit_shadow_size,
				})
				UI.RoundRect({
					x:x_caret-obj.edit_padding-obj.edit_border_width,y:y_caret,w:Math.max(x_caret_r-x_caret,obj.w_edit)+(obj.edit_padding+obj.edit_border_width)*2,h:hc,
					color:obj.edit_bgcolor,border_width:obj.edit_border_width,border_color:obj.edit_border_color,
					round:obj.edit_round,
				})
				var hc_editing=UI.GetCharacterHeight(obj.font_edit);
				W.Edit("value_edit",{
					x:x_caret-obj.edit_padding,y:y_caret+(hc-hc_editing)*0.5,w:Math.max(x_caret_r-x_caret,obj.w_edit)+obj.edit_padding*2,h:hc_editing,
					font:obj.font_edit, tid:rg.tid, color:rg.color, text:s_text,
					is_single_line:1,right_side_autoscroll_margin:0.5,
					precise_ctrl_lr_stop:UI.TestOption("precise_ctrl_lr_stop"),
					same_line_only_left_right:!UI.TestOption("left_right_line_wrap"),
					owner:obj,
					additional_hotkeys:[{key:"ESCAPE",action:function(){
						//cancel the change
						var obj=this.owner
						obj.m_show_edit=0;
						UI.Refresh()
					}}],
					OnBlur:function(){
						var obj=this.owner
						obj.m_show_edit=0;
						UI.Refresh()
					},
					OnEnter:function(){
						//apply the change - binary patch / undo queue
						var obj=this.owner
						obj.m_show_edit=0;
						var ret;
						var stext_raw=this.ed.GetText();
						obj.DismissNotification()
						try{
							ret=JSON.parse(Duktape.__eval_expr_sandbox(stext_raw))
						}catch(e){
							obj.CreateNotification('错',UI.ED_RichTextCommandChar(UI.RICHTEXT_COMMAND_SET_STYLE+2)+UI._("Bad value expression: ")+e.message)
							UI.Refresh()
							return;
						}
						if(Array.isArray(ret)){
							ret=new Uint8Array(ret);
						}
						if(UI.BIN_isBuffer(ret)||!this.tid&&(typeof ret)=='string'){
							//string case
							var buf_str=new Buffer(ret);
							obj.PushUndo(obj.m_sel1,buf_str.length)
							buf_str.copy(obj.m_data,obj.m_sel1,0,Math.min(obj.m_data.length-obj.m_sel1,buf_str.length));
							obj.m_sel1+=buf_str.length;
							obj.ValidateSelection(0,-1);
							UI.Refresh()
							return;
						}
						obj.PushUndo(obj.m_sel1,1<<(this.tid&3))
						switch(this.tid){
						case 0://b8
						case 4://i8
						case 16+0://b8BE
						case 16+4://i8BE
							obj.m_data.writeInt8(ret,obj.m_sel1);
							break;
						case 1://b16
						case 5://i16
							obj.m_data.writeInt16LE(ret,obj.m_sel1);
							break;
						case 16+1://b16BE
						case 16+5://i16BE
							obj.m_data.writeInt16BE(ret,obj.m_sel1);
							break;
						case 2://b32
						case 6://i32
							obj.m_data.writeInt32LE(ret,obj.m_sel1);
							break;
						case 16+2://b32BE
						case 16+6://i32BE
							obj.m_data.writeInt32BE(ret,obj.m_sel1);
							break;
						case 3://b64
						case 7://i64
						case 11://u64
						case 16+3://b64BE
						case 16+7://i64BE
						case 16+11://u64BE
							UI.BIN_write64(obj.m_data,stext_raw,this.tid,ret,obj.m_sel1)
							break;
						case 8://u8
						case 16+8://u8BE
							obj.m_data.writeUInt8(ret,obj.m_sel1);
							break;
						case 9://u16
							obj.m_data.writeUInt16LE(ret,obj.m_sel1);
							break;
						case 16+9://u16BE
							obj.m_data.writeUInt16BE(ret,obj.m_sel1);
							break;
						case 10://u32
							obj.m_data.writeUInt32LE(ret,obj.m_sel1);
							break;
						case 16+10://u32BE
							obj.m_data.writeUInt32BE(ret,obj.m_sel1);
							break;
						case 13://f16
							obj.m_data.writeUInt16LE(UI.BIN_float2half(ret),obj.m_sel1);
							break;
						case 16+13://f16BE
							obj.m_data.writeUInt16BE(UI.BIN_float2half(ret),obj.m_sel1);
							break;
						case 14://f32
							obj.m_data.writeFloatLE(ret,obj.m_sel1);
							break;
						case 16+14://f32BE
							obj.m_data.writeFloatBE(ret,obj.m_sel1);
							break;
						case 15://f64
							obj.m_data.writeDoubleLE(ret,obj.m_sel1);
							break;
						case 16+15://f64BE
							obj.m_data.writeDoubleBE(ret,obj.m_sel1);
							break;
						}
						obj.m_sel1+=(1<<(this.tid&3));
						obj.ValidateSelection(0,-1);
						UI.Refresh()
					},
				});
				if(obj.m_edit_event){
					UI.SetFocus(obj.value_edit)
					var edit_sel0=0;
					if((rg.tid&12)==TYPE_BYTE*4){
						if(obj.m_edit_event[0]=='OnTextInput'||obj.m_edit_event[0]=='OnTextEdit'){
							var s=obj.m_edit_event[1].text;
							if(s!=undefined&&s.length==1&&'0123456789abcdefABCDEF'.indexOf(s)>=0){
								edit_sel0=2;
							}
						}
					}
					obj.value_edit.SetSelection(edit_sel0,obj.value_edit.ed.GetTextSize())
					obj.value_edit[obj.m_edit_event[0]].call(obj.value_edit,obj.m_edit_event[1]);
					obj.m_edit_event=undefined;
				}
			}else{
				//binary editor caret
				var scale=UI.pixels_per_unit;
				if(UI.HasFocus(obj)){
					UI.SetCaret(UI.context_window,
						x_caret*scale,y_caret*scale,
						obj.caret_width*scale,hc*scale,
						obj.caret_color,obj.caret_flicker);
				}
			}
			if(main_area_scale_factor!=1){
				UI.PopSubWindow()
				y_main_area=bk_y_main_area;
				h_main_area=bk_h_main_area;
			}
			///////////////
			//minimap
			var n_lines_disp_minimap=Math.floor(h_main_area*UI.pixels_per_unit);
			var n_lines_tot=Math.floor((obj.m_data.length+obj.m_w_bytes-1)/obj.m_w_bytes);
			n_lines_disp_minimap=Math.min(n_lines_disp_minimap,n_lines_tot);
			var scroll_max=Math.floor(Math.max(obj.m_data.length+obj.m_w_bytes-1-(n_lines_disp-1)*obj.m_w_bytes,0)/obj.m_w_bytes)*obj.m_w_bytes;
			var scroll_max_minimap=Math.floor(Math.max(obj.m_data.length+obj.m_w_bytes-1-n_lines_disp_minimap*obj.m_w_bytes,0)/obj.m_w_bytes)*obj.m_w_bytes;
			var t_scroll=obj.m_scroll/Math.max(scroll_max,1);
			var scroll_minimap=Math.floor(t_scroll*scroll_max_minimap/obj.m_w_bytes)*obj.m_w_bytes;
			UI.GLWidget(function(){
				UI.BIN_RenderMinimap(
					x_minimap+obj.minimap_padding,
					y_main_area,
					undefined,h_main_area,obj,scroll_minimap,obj.m_ramp)
			});
			//var x_panel=x_minimap+w_minimap
			//var w_minimap_bars=x_panel-(x_minimap+obj.minimap_padding*0.5);
			var w_minimap_bars=obj.x+obj.w-(x_minimap+obj.minimap_padding*0.5);
			UI.RoundRect({x:x_minimap+obj.minimap_padding*0.5,y:y_main_area,w:1,h:h_main_area,color:obj.separator_color})
			var minimap_page_y0=Math.max(obj.m_scroll-scroll_minimap,0)/obj.m_w_bytes/UI.pixels_per_unit;
			var minimap_page_y1=Math.max(obj.m_scroll+n_lines_disp*obj.m_w_bytes-scroll_minimap,0)/obj.m_w_bytes/UI.pixels_per_unit;
			UI.RoundRect({
				x:x_minimap+obj.minimap_padding*0.5, y:y_main_area+minimap_page_y0, w:w_minimap_bars, h:minimap_page_y1-minimap_page_y0,
				color:obj.minimap_page_shadow})
			UI.RoundRect({
				x:x_minimap+obj.minimap_padding*0.5, y:y_main_area+minimap_page_y0, w:w_minimap_bars, h:obj.minimap_page_border_width,
				color:obj.minimap_page_border_color})
			UI.RoundRect({
				x:x_minimap+obj.minimap_padding*0.5, y:y_main_area+minimap_page_y1-obj.minimap_page_border_width, w:w_minimap_bars, h:obj.minimap_page_border_width,
				color:obj.minimap_page_border_color})
			///////////////
			//panel
			obj.goto_bar_edit=undefined;
			if(!obj.is_preview){
				var tab_tools=UI.OpenUtilTab("binary_tools","quiet");
				if(tab_tools){
					obj.goto_bar_edit=(tab_tools&&tab_tools.util_widget&&tab_tools.util_widget.goto_bar_edit);
				}
			}
			///////////////
			//minimap mouse region
			//W.Region("rgn_minimap",{owner:obj,x:x_minimap,y:y_main_area,w:x_panel-x_minimap,h:h_main_area},W.SlaveRegion_prototype)
			W.Region("rgn_minimap",{owner:obj,x:x_minimap,y:y_main_area,w:obj.x+obj.w-x_minimap,h:h_main_area},W.SlaveRegion_prototype)
			obj.m_minimap_page_y0=y_main_area+minimap_page_y0;
			obj.m_minimap_page_y1=y_main_area+minimap_page_y1;
			obj.m_scroll_max=scroll_max;
			obj.m_h_minimap=n_lines_disp_minimap/UI.pixels_per_unit;
			///////////////
			var menu_edit=UI.BigMenu("&Edit")
			menu_edit.AddNormalItem({text:"&Undo",icon:"撤",enable_hotkey:0,key:"CTRL+Z",action:function(){
				obj.Undo()
			}})
			menu_edit.AddNormalItem({text:"&Redo",icon:"做",enable_hotkey:0,key:"SHIFT+CTRL+Z",action:function(){
				obj.Redo()
			}})
			if(obj.m_undo_queue&&obj.m_undo_queue.length>0){
				UI.ToolButton("undo",{tooltip:"Undo - CTRL+Z",action:function(){obj.Undo();}})
			}
			if(obj.m_redo_queue&&obj.m_redo_queue.length>0){
				UI.ToolButton("redo",{tooltip:"Redo - SHIFT+CTRL+Z",action:function(){obj.Redo();}})
			}
			menu_edit=undefined;
			var menu_search=UI.BigMenu("&Search")
			menu_search.AddNormalItem({text:"&Find...",icon:"s",enable_hotkey:1,key:'CTRL+F',action:function(){
				obj.m_show_find=!obj.m_show_find;
				UI.Refresh()
				return;
			}})
			menu_search.AddButtonRow({text:"Find previous / next"},[
				{key:"SHIFT+F3",text:"find_up",icon:"上",tooltip:'Prev - SHIFT+F3',action:function(){
					obj.FindNext(obj.m_sel1,-1,obj.m_last_needle)
				}},{key:"F3",text:"find_down",icon:"下",tooltip:'Next - F3',action:function(){
					obj.FindNext(obj.m_sel1,1,obj.m_last_needle)
				}}])
			menu_search.AddButtonRow({text:"Find the current word"},[
				{key:"SHIFT+CTRL+F3",text:"word_up",icon:"上",tooltip:'Prev - SHIFT+CTRL+F3',action:function(){
					obj.FindNext(obj.m_sel1,-1,new Uint8Array(obj.GetSelectionAsBuffer()))
				}},{key:"CTRL+F3",text:"word_down",icon:"下",tooltip:'Next - CTRL+F3',action:function(){
					obj.FindNext(obj.m_sel1,1,new Uint8Array(obj.GetSelectionAsBuffer()))
				}}])
			menu_search.AddSeparator();
			menu_search.AddNormalItem({text:"Set &bookmark",icon:"签",enable_hotkey:1,key:'SHIFT+CTRL+Q',action:function(){
				obj.ToggleBookmark();
			}})
			menu_search.AddButtonRow({text:"Go to bookmark"},[
				{key:"SHIFT+F2",text:"bookmark_up",icon:"上",tooltip:'Prev - SHIFT+F2',action:function(){
					obj.GotoNextBookmark(-1,0)
				}},{key:"F2",text:"bookmark_down",icon:"下",tooltip:'Next - F2',action:function(){
					obj.GotoNextBookmark(1,0)
				}}])
			menu_search.AddButtonRow({text:"Select to bookmark"},[
				{text:"bookmark_sel_up",icon:"上",tooltip:'Prev',action:function(){
					obj.GotoNextBookmark(-1,1)
				}},{text:"bookmark_sel_down",icon:"下",tooltip:'Next',action:function(){
					obj.GotoNextBookmark(1,1)
				}}])
			if(UI.nd_focus==obj){
				for(var i=0;i<10;i++){
					W.Hotkey("",{key:'SHIFT+CTRL+'+i.toString(),action:function(i){
						this.ToggleBookmark(i);
						return 0;
					}.bind(obj,i)});
					W.Hotkey("",{key:'CTRL+'+i.toString(),action:function(id){
						for(var i=0;i<this.m_bookmarks.length;i++){
							var bm_i=this.m_bookmarks[i];
							if(bm_i.id==id){
								this.m_sel0=bm_i.addr;
								this.m_sel1=bm_i.addr;
								this.ValidateSelection(0,-1)
								this.AutoScroll()
								UI.Refresh();
								break;
							}
						}
						return 0;
					}.bind(obj,i)});
				}
			}
			menu_search=undefined;
		}
		UI.FillLanguageMenu(UI.GetFileNameExtension(obj.file_name),'Binary',function(name){
			if(name=='Binary'){return;}
			if((obj.saved_point||0)==obj.m_undo_queue.length){
				obj.SaveMetaData();
			}
			var new_metadata=(UI.m_ui_metadata[obj.file_name]||{});
			new_metadata.m_language_id=name;
			UI.m_ui_metadata[obj.file_name]=new_metadata;
			//console.log('>>>',obj.file_name,new_metadata.m_language_id);
			if((obj.saved_point||0)!=obj.m_undo_queue.length){
				obj.CreateNotification("警",UI._("Save and reload to reopen it in the text editor"))
			}else{
				var fn=obj.file_name;
				UI.top.app.document_area.just_created_a_tab=1;
				UI.top.app.document_area.CloseTab();
				UI.OpenEditorWindow(fn);
			}
		})
	//if(obj.m_notification){
	UI.RoundRect({
		x:obj.x-obj.notification_shadow_size,y:y_main_area-obj.notification_shadow_size,w:obj.w+obj.notification_shadow_size*2,h:obj.notification_shadow_size*2,
		color:obj.notification_shadow_color,
		round:obj.notification_shadow_size,
		border_width:-obj.notification_shadow_size,
	})
	//}
	UI.PopCliprect()
	UI.End()
	obj.y=y_main_area;
	obj.h=h_main_area;
	return obj;
}

UI.NewBinaryEditorTab=function(fname0){
	var file_name=fname0||("<New #"+(g_new_id++).toString()+">")
	//DetectRepository(file_name)
	UI.top.app.quit_on_zero_tab=0;
	return UI.NewTab({
		file_name:file_name,
		title:UI.GetSmartTabName(file_name),
		tooltip:file_name,
		document_type:'binary',
		UpdateTitle:function(){
			var fn_display=(this.main_widget&&this.main_widget.file_name||this.file_name)
			this.title=UI.GetSmartTabName(fn_display);
			this.tooltip=fn_display;
			this.need_save=0
			if(this.main_widget&&(this.main_widget.saved_point||0)!=this.main_widget.m_undo_queue.length){
				this.title=this.title+'*';
				this.need_save=1;
			}
		},
		body:function(){
			//use styling for editor themes
			UI.context_parent.body=this.main_widget;
			if(this.main_widget){this.file_name=this.main_widget.file_name}
			var attrs={
				'anchor':'parent','anchor_align':"fill",'anchor_valign':"fill",
				'x':0,'y':0,
				'file_name':this.file_name,
			};
			var body=W.BinaryEditor("body",attrs)
			if(!this.main_widget){
				this.main_widget=body;
			}
			body.title=UI.GetSmartTabName(body.file_name)
			body.tooltip=body.file_name
			this.need_save=0
			if((body.saved_point||0)!=body.m_undo_queue.length){
				body.title=body.title+'*'
				this.need_save=1
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
			this.need_save=0
			var body=this.main_widget;
			if((body.saved_point||0)!=body.m_undo_queue.length){
				body.title=body.title+'*'
				this.need_save=1
			}
		},
		SaveAs:function(){
			if(!this.main_widget){return;}
			var fn=IO.DoFileDialog(1,undefined,
				this.main_widget.file_name.indexOf('<')>=0?
					UI.m_new_document_search_path:
					UI.GetPathFromFilename(this.main_widget.file_name));
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
		//color_theme:[UI.Platform.BUILD=="debug"?0xff1f1fb4:0xffb4771f],
	})
};

W.BinaryToolsPage=function(id,attrs){
	//share the style
	var obj=UI.StdWidget(id,attrs,"binary_editor");
	UI.Begin(obj)
	//var w_shadow=obj.sxs_shadow_size;
	//UI.RoundRect({
	//	x:x_panel-w_shadow,y:obj.y-w_shadow,w:w_shadow*2,h:obj.h+w_shadow*2,
	//	color:obj.sxs_shadow_color,border_width:-w_shadow,round:w_shadow,
	//})
	UI.RoundRect({
		x:obj.x,y:obj.y,w:obj.w,h:obj.h,
		color:obj.sxs_bgcolor,
	})
	var obj_real=obj.editor_widget;
	if(!obj_real){
		UI.End()
		return obj
	}
	var y_current=obj.y+8;
	//go-to bar
	var text_goto=W.Text("",{x:obj.x+12,y:y_current,font:obj.font_panel,text:UI._("Go to"),color:obj.text_color_panel})
	var got_edit_before=!!(obj.goto_bar_edit&&obj.goto_bar_edit.edit)
	W.EditBox("goto_bar_edit",{
		x:text_goto.x+text_goto.w+4,w:144,y:y_current+2,h:24,
		is_single_line:1,
		value:obj_real.FormatAddr(obj_real.m_sel1),
		font:obj.font_goto,
		OnChange:function(value){
			var ret=obj_real.m_sel1;
			try{
				ret=JSON.parse(Duktape.__eval_expr_sandbox(value));
			}catch(e){
				obj_real.CreateNotification('错',UI.ED_RichTextCommandChar(UI.RICHTEXT_COMMAND_SET_STYLE+2)+UI._("Bad address: ")+e.message)
				UI.SetFocus(obj_real)
				UI.Refresh()
				return;
			}
			if(typeof(ret)=='number'){
				obj_real.m_sel1=ret;
				obj_real.ValidateSelection(0,-1);
			}
			UI.SetFocus(obj_real)
			UI.Refresh()
		},
	});
	if(!got_edit_before&&obj.goto_bar_edit.edit){
		var doc_goto=obj.goto_bar_edit.edit;
		doc_goto.SetSelection(2,doc_goto.ed.GetTextSize())
	}
	y_current+=32;
	//width buttons
	var text_width=W.Text("",{x:obj.x+12,y:y_current,font:obj.font_panel,text:UI._("Display width"),color:obj.text_color_panel})
	var x_buttons=text_width.x+text_width.w+4;
	/*W.Button("btn_w16",{
		style:UI.default_styles.check_button,
		x:x_buttons,y:y_current,w:24,h:24,
		value:obj_real.m_w_bytes==16,OnClick:function(){obj_real.ResetWBytes(16)},
		font:obj.font_panel_fixed,text:"16"});x_buttons+=28;
	W.Button("btn_w32",{
		style:UI.default_styles.check_button,
		x:x_buttons,y:y_current,w:24,h:24,
		value:obj_real.m_w_bytes==32,OnClick:function(){obj_real.ResetWBytes(32)},
		font:obj.font_panel_fixed,text:"32"});x_buttons+=28;
	W.Button("btn_w48",{
		style:UI.default_styles.check_button,
		x:x_buttons,y:y_current,w:24,h:24,
		value:obj_real.m_w_bytes==48,OnClick:function(){obj_real.ResetWBytes(48)},
		font:obj.font_panel_fixed,text:"48"});x_buttons+=28;*/
	W.EditBox("width_edit",{
		x:x_buttons,w:84,y:y_current+2,h:24,
		is_single_line:1,
		value:obj_real.m_w_bytes.toString(),
		font:obj.font_goto,
		OnChange:function(value){
			var ret=obj_real.m_w_bytes;
			try{
				ret=JSON.parse(Duktape.__eval_expr_sandbox(value));
			}catch(e){
				obj_real.CreateNotification('错',UI.ED_RichTextCommandChar(UI.RICHTEXT_COMMAND_SET_STYLE+2)+UI._("Bad width: ")+e.message)
				UI.SetFocus(obj_real)
				UI.Refresh()
				return;
			}
			if(typeof(ret)=='number'){
				ret=(ret|0);
				if(ret>0&&ret<1024){
					obj_real.ResetWBytes(ret);
				}
			}
			UI.SetFocus(obj_real)
			UI.Refresh()
		},
	});
	//W.Button("btn_w64",{
	//	style:UI.default_styles.check_button,
	//	x:x_buttons,y:y_current,w:24,h:24,
	//	value:obj.m_w_bytes==64,OnClick:function(){obj.ResetWBytes(64)},
	//	font:obj.font_panel_fixed,text:"64"});x_buttons+=28;
	y_current+=32;
	W.Text("",{x:obj.x+12,y:y_current,font:obj.font_panel,text:UI._("Display type"),color:obj.text_color_panel})
	y_current+=28;
	//type buttons
	var rg=UI.BIN_GetRangeAt(obj_real,Math.min(obj_real.m_sel0,obj_real.m_sel1));
	for(var i=0;i<4;i++){
		for(var j=0;j<4;j++){
			var tid=i*4+j;
			//if(tid==12){continue;}
			var btn=W.Button("btn_t"+tid,{
				style:UI.default_styles.check_button,
				x:obj.x+24+48*i,y:y_current+28*j,w:48,h:28,
				value:tid==12?((rg.tid&16)!=0):(tid==(rg.tid&15)),
				OnClick:(function(tid){
					var sel=obj_real.GetRangeFromSelection();
					var sel0=sel[0],sel1=sel[1];
					if(Math.floor((sel1-sel0)/(1<<(tid&3)))*(1<<(tid&3))==sel1-sel0&&sel1-sel0>0){
						obj_real.SetRange(sel0,sel1,{tid:tid});
					}
					UI.Refresh()
				}).bind(undefined,tid==12?rg.tid^16:tid+(rg.tid&16)),
				font:obj.font_panel_fixed,
				text:tid==12?"BE":g_types[i]+g_sizes[j]});
			if(tid==12){
				btn.tooltip='Big endian';
			}
		}
	}
	y_current+=28*4+4;
	W.Text("",{x:obj.x+12,y:y_current,font:obj.font_panel,text:UI._("Display color"),color:obj.text_color_panel})
	y_current+=28;
	var g_colors=obj.color_choices;
	for(var i=0;i<2;i++){
		for(var j=0;j<5;j++){
			var C=(g_colors[i*5+j]|0);
			W.Button("btn_C"+C,{
				style:UI.default_styles.check_button,
				x:obj.x+24+28*j,y:y_current+28*i,w:28,h:28,
				value:(rg.color==C),
				OnClick:(function(C){
					var sel=obj_real.GetRangeFromSelection();
					var sel0=sel[0],sel1=sel[1];
					obj_real.SetRange(sel0,sel1,{color:C});
					UI.Refresh()
				}).bind(undefined,C),
				font:obj.font_panel_icon,
				text_color:C,
				text:'黑'});
		}
	}
	y_current+=3*28+4;
	//quick numbers
	//todo
	UI.End()
	return obj
};

UI.RegisterUtilType("binary_tools",function(){return UI.NewTab({
	title:UI._("Binary Tools"),
	area_name:"h_tools",
	body:function(){
		//frontmost doc
		UI.context_parent.body=this.util_widget;
		var tab_frontmost=UI.GetFrontMostEditorTab();
		var obj_real=(tab_frontmost&&tab_frontmost.document_type=="binary"&&tab_frontmost.main_widget);
		var body=W.BinaryToolsPage('body',{
			'anchor':'parent','anchor_align':'fill','anchor_valign':'fill',
			'editor_widget':obj_real,
			'activated':this==UI.top.app.document_area.active_tab,
			'x':0,'y':0});
		this.util_widget=body;
		if(!obj_real){
			UI.m_invalid_util_tabs.push(this.__global_tab_id);
		}
		return body;
	},
	Save:function(){},
	SaveMetaData:function(){},
	OnDestroy:function(){},
})});
