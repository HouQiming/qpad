var UI=require("gui2d/ui");
var W=require("gui2d/widgets");
require("res/lib/global_doc");

var TYPE_BYTE=0;
var TYPE_INT=1;
var TYPE_UINT=2;
var TYPE_FLOAT=3;
var TYPE_MASK_BE=16;
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
		this.AutoScroll()
	},
	GetNLinesDisp:function(){
		var hc=UI.GetCharacterHeight(this.font);
		return Math.max((this.h-this.m_h_addr)/hc,1)|0;
	},
	StartEdit:function(s,event){
		if(this.m_sel1>=this.m_data.length){return;}
		this.m_sel1=Math.min(this.m_sel0,this.m_sel1);
		this.m_sel0=this.m_sel1;
		this.m_show_edit=1
		this.m_edit_event=[s,event];
		UI.Refresh();
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
		}else if(IsHotkey(event,"CTRL+END SHIFT+CTRL+END")){
			this.m_sel1=this.m_data.length;
		}else if(IsHotkey(event,"CTRL+V")){
			this.StartEdit("onKeyDown",event);
		}else{
			return;
		}
		this.ValidateSelection(is_shift,validation_dir);
		UI.Refresh()
	},
	MapMouseToAddr:function(event,rgid){
		var hc=UI.GetCharacterHeight(this.font);
		var w_digit=UI.GetCharacterAdvance(this.font,48);
		var w_space1=w_digit*0.75;
		var w_space4=w_digit*0.25;
		var w_space8=w_digit*0.25;
		var mapXLeft=function(daddr_x){
			return w_digit*2*daddr_x+w_space1*(daddr_x)+w_space4*(daddr_x>>2)+w_space8*(daddr_x>>3);
		};
		var daddr_y=Math.floor((event.y-(this.y+this.m_h_addr))/hc);
		var daddr_x=0;
		if(rgid=="rgn_text"){
			daddr_x=Math.floor((event.x-this.m_x_text)/w_digit);
		}else{
			daddr_x=0;
			for(var x=0;x<this.m_w_bytes;x++){
				if(this.m_x_main+mapXLeft(x)<event.x){
					daddr_x=x;
				}else{
					break;
				}
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
			this.ValidateSelection(0,-1)
			if(event.clicks==2){
				//double-click
				this.m_sel1=Math.floor(this.m_sel1/4)*4;
				this.ValidateSelection(0,-1)
				//non-shift updates sel0, now update sel1 again
				this.m_sel1+=4;
				this.ValidateSelection(1,1)
			}else if(event.clicks>=3){
				//triple-click
				this.m_sel1=Math.floor(this.m_sel1/this.m_w_bytes)*this.m_w_bytes;
				this.ValidateSelection(0,-1)
				//non-shift updates sel0, now update sel1 again
				this.m_sel1+=this.m_w_bytes;
				this.ValidateSelection(1,1)
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
			var h_scrollable=Math.max(this.h-(this.m_minimap_page_y1-this.m_minimap_page_y0),1);
			this.m_scroll=Math.floor(this.drag_value0+(event.y-this.drag_y0)/h_scrollable*this.m_scroll_max);
			this.ValidateScroll();
			UI.Refresh()
		}else{
			var mouse_sel=this.MapMouseToAddr(event,this.is_dragging);
			if(mouse_sel>=this.drag_value0&&mouse_sel<=this.drag_value1){
				this.m_sel0=this.drag_value0;
				this.m_sel1=this.drag_value1;
			}else{
				if(mouse_sel<this.drag_value0){
					this.m_sel0=this.drag_value1;
				}else{
					this.m_sel0=this.drag_value0;
				}
				this.m_sel1=mouse_sel;
			}
			this.AutoScroll()
			UI.Refresh()
		}
	},
	OnMouseUp:function(event,rgid){
		this.OnMouseMove(event,rgid);
		this.is_dragging=undefined;
	},
	SaveMetaData:function(){
		if(this.is_preview){return;}
		var new_metadata=(UI.m_ui_metadata[this.file_name]||{});
		new_metadata.sel0=this.m_sel0;
		new_metadata.sel1=this.m_sel1;
		new_metadata.ranges=this.m_ranges;
		new_metadata.w_bytes=this.m_w_bytes;
		new_metadata.m_scroll=this.m_scroll;
		UI.m_ui_metadata[this.file_name]=new_metadata
	},
	Save:function(){
		//todo
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
		if((rg_template.color==undefined||rg_template.color==this.text_color)&&(rg_template.tid==undefined||rg_template.tid==0)){
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
};

W.SlaveRegion_prototype={
	OnMouseDown:function(event){UI.CaptureMouse(this);this.owner.OnMouseDown(event,this.__id);},
	OnMouseMove:function(event){this.owner.OnMouseMove(event,this.__id);},
	OnMouseUp:function(event){this.owner.OnMouseUp(event,this.__id);UI.ReleaseMouse(this);},
};

var g_types=['b','i','u','f'];
var g_sizes=[8,16,32,64];
var g_colors=[
	0xffb4771f,0xff2ca033,0xff1c1ae3,0xff007fff,0xff9a3d6a,
	0xffe3cea6,0xff8adfb2,0xff999afb,0xff6fbffd,0xffd6b2ca,
	0xff00ffff,0xff8888b8,0xff000080,0xff7f7f7f,0xff000000];
W.BinaryEditor=function(id,attrs){
	//could do the main view in pure JS... minimap is a different story though
	//	the duktape f32/f64 <-> text code is more precise
	//	to-text doesn't have to be - we have a width budget anyway
	//any complicated edit could be performed in the parser script
	var obj=UI.StdWidget(id,attrs,"binary_editor",W.BinaryEditor_prototype);
	var w_digit=UI.GetCharacterAdvance(obj.font,48)
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
		return {x:mapX(obj.m_w_bytes)-w_digit*2+w_digit*daddr_x,y:daddr_y};
	};
	W.PureRegion(id,obj)
	UI.PushCliprect(obj.x,obj.y,obj.w,obj.h)
	UI.Begin(obj)
		if(!obj.m_data){
			var loaded_metadata=(UI.m_ui_metadata[obj.file_name]||{});
			obj.m_data=Buffer(Duktape.Buffer(UI.BIN_MapCopyOnWrite(obj.file_name)))
			if(!loaded_metadata.ranges){
				//todo: default parsing script
			}
			obj.m_ranges=(loaded_metadata.ranges||[]);
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
		}
		var hc=UI.GetCharacterHeight(obj.font);
		var n_lines_disp=Math.max((obj.h-obj.m_h_addr)/hc,1)|0;
		var lg=obj.m_lg_addr;
		var y_linenumber0;
		var hc_linenumber=UI.GetCharacterHeight(obj.m_line_number_font);
		if(lg<=8){
			y_linenumber0=obj.y+(hc-hc_linenumber)*0.5
		}else{
			y_linenumber0=obj.y+(hc*0.5)
		}
		//line numbers
		var dx_text=mapX(obj.m_w_bytes)-w_digit*2;
		var x_minimap_min=obj.x+obj.m_w_addr+dx_text+w_digit*obj.m_w_bytes;
		var x_minimap=x_minimap_min
		UI.RoundRect({x:obj.x,y:obj.y,w:obj.w,h:obj.h,color:obj.bgcolor})
		UI.RoundRect({x:obj.x,y:obj.y,w:obj.m_w_addr-4,h:obj.h,color:obj.line_number_bgcolor})
		UI.RoundRect({x:obj.x,y:obj.y,w:x_minimap+obj.minimap_padding*0.5-obj.x,h:obj.m_h_addr,color:obj.line_number_bgcolor})
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
				UI.DrawChar(obj.m_line_number_font,x_linenumber,obj.y+4,C,ch);
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
						y:obj.y+obj.m_h_addr+i*hc,
						w:x1-x0,
						h:hc,
						color:obj.bgcolor_selection
					})
				}
			}
			fDrawSel(0,mapX(obj.m_w_bytes-1));
			xy0=XYFromCcntText(Math.min(obj.m_sel0,obj.m_sel1));
			xy1=XYFromCcntText(Math.max(obj.m_sel0,obj.m_sel1));
			fDrawSel(dx_text,dx_text+w_digit*obj.m_w_bytes);
		}
		UI.BIN_Render(obj.x+obj.m_w_addr,obj.y+obj.m_h_addr,obj.w-obj.m_w_addr,obj.h-obj.m_h_addr,obj,obj.m_scroll)
		///////////////
		//minimap
		var n_lines_disp_minimap=Math.floor(obj.h*UI.pixels_per_unit);
		var scroll_max=Math.floor(Math.max(obj.m_data.length+obj.m_w_bytes-1-(n_lines_disp-1)*obj.m_w_bytes,0)/obj.m_w_bytes)*obj.m_w_bytes;
		var scroll_max_minimap=Math.floor(Math.max(obj.m_data.length+obj.m_w_bytes-1-n_lines_disp_minimap*obj.m_w_bytes,0)/obj.m_w_bytes)*obj.m_w_bytes;
		var t_scroll=obj.m_scroll/Math.max(scroll_max,1);
		var scroll_minimap=Math.floor(t_scroll*scroll_max_minimap/obj.m_w_bytes)*obj.m_w_bytes;
		var w_minimap=obj.m_w_bytes/UI.pixels_per_unit;
		UI.GLWidget(function(){
			UI.BIN_RenderMinimap(
				x_minimap+obj.minimap_padding,
				obj.y,
				undefined,obj.h,obj,scroll_minimap,obj.m_ramp)
		});
		var x_panel=x_minimap+w_minimap+obj.minimap_padding*1.5+obj.sxs_shadow_size*0.5;
		var w_minimap_bars=x_panel-(x_minimap+obj.minimap_padding*0.5);
		UI.RoundRect({x:x_minimap+obj.minimap_padding*0.5,y:obj.y,w:1,h:obj.h,color:obj.separator_color})
		var minimap_page_y0=Math.max(obj.m_scroll-scroll_minimap,0)/obj.m_w_bytes/UI.pixels_per_unit;
		var minimap_page_y1=Math.max(obj.m_scroll+n_lines_disp*obj.m_w_bytes-scroll_minimap,0)/obj.m_w_bytes/UI.pixels_per_unit;
		UI.RoundRect({
			x:x_minimap+obj.minimap_padding*0.5, y:obj.y+minimap_page_y0, w:w_minimap_bars, h:minimap_page_y1-minimap_page_y0,
			color:obj.minimap_page_shadow})
		UI.RoundRect({
			x:x_minimap+obj.minimap_padding*0.5, y:obj.y+minimap_page_y0, w:w_minimap_bars, h:obj.minimap_page_border_width,
			color:obj.minimap_page_border_color})
		UI.RoundRect({
			x:x_minimap+obj.minimap_padding*0.5, y:obj.y+minimap_page_y1-obj.minimap_page_border_width, w:w_minimap_bars, h:obj.minimap_page_border_width,
			color:obj.minimap_page_border_color})
		///////////////
		//panel
		//todo: fix panel size, x_scroll the main area
		var w_shadow=obj.sxs_shadow_size;
		UI.RoundRect({
			x:x_panel-w_shadow,y:obj.y-w_shadow,w:w_shadow*2,h:obj.h+w_shadow*2,
			color:obj.sxs_shadow_color,border_width:-w_shadow,round:w_shadow,
		})
		UI.RoundRect({
			x:x_panel,y:obj.y,w:obj.x+obj.w-x_panel,h:obj.h,
			color:obj.sxs_bgcolor,
		})
		var y_current=obj.y+8;
		W.Text("",{x:x_panel+12,y:y_current,font:obj.font_panel,text:"Display width",color:obj.text_color_panel})
		var x_buttons=x_panel+128;
		W.Button("btn_w16",{
			style:UI.default_styles.check_button,
			x:x_buttons,y:y_current,w:24,h:24,
			value:obj.m_w_bytes==16,OnClick:function(){obj.ResetWBytes(16)},
			font:obj.font_panel_fixed,text:"16"});x_buttons+=28;
		W.Button("btn_w32",{
			style:UI.default_styles.check_button,
			x:x_buttons,y:y_current,w:24,h:24,
			value:obj.m_w_bytes==32,OnClick:function(){obj.ResetWBytes(32)},
			font:obj.font_panel_fixed,text:"32"});x_buttons+=28;
		W.Button("btn_w48",{
			style:UI.default_styles.check_button,
			x:x_buttons,y:y_current,w:24,h:24,
			value:obj.m_w_bytes==48,OnClick:function(){obj.ResetWBytes(48)},
			font:obj.font_panel_fixed,text:"48"});x_buttons+=28;
		y_current+=32;
		W.Text("",{x:x_panel+12,y:y_current,font:obj.font_panel,text:"Display type",color:obj.text_color_panel})
		y_current+=28;
		//type buttons
		var rg=UI.BIN_GetRangeAt(obj,Math.min(obj.m_sel0,obj.m_sel1));
		for(var i=0;i<4;i++){
			for(var j=0;j<4;j++){
				var tid=i*4+j;
				//if(tid==12){continue;}
				W.Button("btn_t"+tid,{
					style:UI.default_styles.check_button,
					x:x_panel+24+48*i,y:y_current+28*j,w:48,h:28,
					value:tid==12?((rg.tid&16)!=0):(tid==(rg.tid&15)),
					OnClick:(function(tid){
						var sel=obj.GetRangeFromSelection();
						var sel0=sel[0],sel1=sel[1];
						if(Math.floor((sel1-sel0)/(1<<(tid&3)))*(1<<(tid&3))==sel1-sel0&&sel1-sel0>0){
							obj.SetRange(sel0,sel1,{tid:tid});
						}
						UI.Refresh()
					}).bind(undefined,tid==12?rg.tid^16:tid),
					font:obj.font_panel_fixed,
					text:tid==12?"BE":g_types[i]+g_sizes[j]});
			}
		}
		y_current+=28*4+4;
		W.Text("",{x:x_panel+12,y:y_current,font:obj.font_panel,text:"Display color",color:obj.text_color_panel})
		y_current+=28;
		for(var i=0;i<3;i++){
			for(var j=0;j<5;j++){
				var C=(g_colors[i*5+j]|0);
				W.Button("btn_C"+C,{
					style:UI.default_styles.check_button,
					x:x_panel+24+28*j,y:y_current+28*i,w:28,h:28,
					value:(rg.color==C),
					OnClick:(function(C){
						var sel=obj.GetRangeFromSelection();
						var sel0=sel[0],sel1=sel[1];
						obj.SetRange(sel0,sel1,{color:C});
						UI.Refresh()
					}).bind(undefined,C),
					font:obj.font_panel_icon,
					text_color:C,
					text:'黑'});
			}
		}
		y_current+=3*28+4;
		//region list
		//todo
		//parsing script
		//todo
		///////////////
		//create mouse regions
		//obj.m_x_ranges=[obj.x+obj.m_w_addr,obj.x+obj.m_w_addr+dx_text,x_minimap_min,x_minimap,x_panel]
		obj.m_x_main=obj.x+obj.m_w_addr;
		obj.m_x_text=obj.x+obj.m_w_addr+dx_text;
		W.Region("rgn_main",{owner:obj,x:obj.m_x_main,y:obj.y+obj.m_h_addr,w:dx_text,h:obj.h-obj.m_h_addr},W.SlaveRegion_prototype)
		W.Region("rgn_text",{owner:obj,x:obj.m_x_text,y:obj.y+obj.m_h_addr,w:w_digit*obj.m_w_bytes,h:obj.h-obj.m_h_addr},W.SlaveRegion_prototype)
		W.Region("rgn_minimap",{owner:obj,x:x_minimap,y:obj.y,w:x_panel-x_minimap,h:obj.h},W.SlaveRegion_prototype)
		obj.m_minimap_page_y0=obj.y+minimap_page_y0;
		obj.m_minimap_page_y1=obj.y+minimap_page_y1;
		obj.m_scroll_max=scroll_max;
		///////////////
		var caret_xy=XYFromCcnt(obj.m_sel1);
		var x_caret=obj.x+obj.m_w_addr+caret_xy.x;
		var y_caret=obj.y+obj.m_h_addr+caret_xy.y*hc;
		if(obj.m_show_edit){
			//edit box at caret
			var caret_r_xy=XYFromCcnt(obj.m_sel1+(1<<(rg.tid&3))-1);
			if(caret_r_xy.y>caret_xy.y){
				caret_r_xy.x=dx_text;
			}
			x_caret_r=obj.x+obj.m_w_addr+caret_r_xy.x+2*w_digit;
			var s_text="";
			if(obj.m_edit_event){
				s_text=UI.BIN_ReadToString(obj,obj.m_sel1);
				if((rg.tid>>3)==TYPE_BYTE){
					s_text="0x"+s_text;
				}
			}
			UI.RoundRect({
				x:x_caret-obj.padding_edit-obj.border_width_edit,y:y_caret,w:x_caret_r-x_caret+(obj.padding_edit+obj.border_width_edit)*2,h:hc,
				color:obj.bgcolor_edit,border_width:obj.border_width_edit,border_color:obj.border_color_edit,
				round:obj.round_edit,
			})
			var hc_editing=UI.GetCharacterHeight(obj.font_edit);
			W.Edit("value_edit",{
				x:x_caret-obj.padding_edit,y:y_caret+(hc-hc_editing)*0.5,w:x_caret_r-x_caret+obj.padding_edit*2,h:hc_editing,
				font:obj.font_edit, tid:rg.tid, color:rg.color, text:s_text,
				is_single_line:1,right_side_autoscroll_margin:0.5,
				owner:obj,
				additional_hotkeys:[{key:"ESCAPE",action:function(){
					//cancel the change
					var obj=this.owner
					obj.m_show_edit=0;
					UI.Refresh()
				}}],
				OnBlur:function(){
					//apply the change - binary patch / undo queue
					var obj=this.owner
					obj.m_show_edit=0;
					var ret;
					try{
						ret=JSON.parse(Duktape.__eval_expr_sandbox(this.ed.GetText()))
					}catch(e){
						//todo: present error to user - notification / script error / ...
						//print(e.stack)
						UI.Refresh()
						return;
					}
					if(!this.tid&&(typeof ret)=='string'){
						//string case
						var buf_str=new Buffer(ret);
						buf_str.copy(obj.m_data,obj.m_sel1,0,Math.min(obj.m_data.length-obj.m_sel1,buf_str.length));
						UI.Refresh()
						return;
					}
					//todo: i64/u64/f16 special cases - try to parse the raw string, change tracking / rendering / undo / redo
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
					case 16+3://b64BE
					case 16+7://i64BE
						//todo
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
					case 11://u64
					case 16+11://u64BE
						//todo
						break;
					case 13://f16
						//todo
						break;
					case 16+13://f16BE
						//todo
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
					UI.Refresh()
				},
				OnEnter:function(){
					this.OnBlur()
				},
			});
			if(obj.m_edit_event){
				UI.SetFocus(obj.value_edit)
				obj.value_edit.SetSelection(0,obj.value_edit.ed.GetTextSize())
				obj.value_edit[obj.m_edit_event[0]].call(obj.value_edit,obj.m_edit_event[1]);
				obj.m_edit_event=undefined;
			}
		}else{
			//binary editor caret
			if(UI.HasFocus(obj)){
				UI.SetCaret(UI.context_window,
					x_caret*UI.pixels_per_unit,y_caret*UI.pixels_per_unit,
					obj.caret_width*UI.pixels_per_unit,hc*UI.pixels_per_unit,
					obj.caret_color,obj.caret_flicker);
			}
		}
	UI.End()
	UI.PopCliprect()
	return obj;
}

UI.NewBinaryEditorTab=function(fname0){
	var file_name=fname0||("<New #"+(g_new_id++).toString()+">")
	//DetectRepository(file_name)
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
			var attrs={
				'anchor':'parent','anchor_align':"fill",'anchor_valign':"fill",
				'x':0,'y':0,
				'file_name':this.file_name,
			};
			var body=W.BinaryEditor("body",attrs)
			if(!this.main_widget){
				this.main_widget=body;
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
			body.title=UI.RemovePath(body.file_name)
			body.tooltip=body.file_name
			//todo
			this.need_save=0
			//if(doc&&(doc.saved_point||0)!=doc.ed.GetUndoQueueLength()){
			//	body.title=body.title+'*'
			//	this.need_save=1
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
			var doc=this.main_widget.doc;
			//todo
			this.need_save=0
			//if((doc.saved_point||0)<doc.ed.GetUndoQueueLength()){
			//	this.need_save=1
			//}
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
		//OnDestroy:function(){
		//	if(this.main_widget){this.main_widget.OnDestroy();}
		//},
		Reload:function(){
			if(this.main_widget){this.main_widget.Reload();}
		},
		color_theme:[UI.Platform.BUILD=="debug"?0xff1f1fb4:0xffb4771f],
	})
};
