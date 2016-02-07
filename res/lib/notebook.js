var UI=require("gui2d/ui");
var W=require("gui2d/widgets");
require("res/lib/global_doc");
require("res/lib/code_editor");

var MeasureEditorSize=function(doc){
	var ed=doc.ed;
	var ccnt_tot=ed.GetTextSize();
	var hc=ed.GetCharacterHeightAt(ccnt_tot);
	var ytot=ed.XYFromCcnt(ccnt_tot).y+hc*2;
	return Math.min(ytot,UI.default_styles.notebook_view.max_lines);
};

W.NotebookView=function(id,attrs){
	var obj=UI.StdWidget(id,attrs,"notebook_view");
	UI.Begin(obj)
	UI.RoundRect(obj)
	if(!obj.m_cells){
		//we shouldn't make build output clog global metadata - a separate json file
		//just a flat list of cells
		//var notes=UI.m_ui_metadata["<notebooks>"];
		//if(!notes){notes={};UI.m_ui_metadata["<notebooks>"]=notes;}
		//notes[obj.m_file_name];
		var fn_notes=obj.m_file_name;
		var obj.m_cells=[];
		if(fn_notes){
			try{
				obj.m_cells=JSON.parse(IO.ReadAll(fn_notes)).cells;
			}catch(err){
				obj.m_cells=[];
			}
		}
		//create the initial data objects
		for(var i=0;i<obj.m_cells.length;i++){
			var cell_i=obj.m_cells[i];
			//////
			var doc_in=UI.CreateEmptyCodeEditor(cell_i.m_language);
			doc_in.Init();
			if(cell_i.m_text_in){doc_in.ed.Edit([0,0,cell_i.m_text_in],1);}
			cell_i.m_text_in=doc_in;
			//////
			var doc_out=UI.CreateEmptyCodeEditor();
			doc_out.read_only=1;
			doc_out.Init();
			if(cell_i.m_text_out){doc_out.ed.Edit([0,0,cell_i.m_text_out],1);}
			cell_i.m_text_out=doc_out;
		}
	}
	//manually-clipped rendering, global scroll bar
	var scroll_y=(obj.scroll_y||0);
	var current_y=-scroll_y;
	var hc=UI.GetCharacterHeight(UI.default_styles.code_editor.editor_style.font);
	for(var i=0;i<obj.m_cells.length;i++){
		var cell_i=obj.m_cells[i];
		var doc_in=cell_i.m_text_in;
		var doc_out=cell_i.m_text_out;
		var h_in=MeasureEditorSize(doc_in);
		var h_out=MeasureEditorSize(doc_out);
		doc_in.RenderWithLineNumbers(
			doc_in.visible_scroll_x,doc_in.visible_scroll_y,
			obj.x,obj.y+current_y,obj.w,h_in,
			"doc_in_"+i.toString())
		current_y+=h_in+obj.h_gap;
		doc_out.RenderWithLineNumbers(
			doc_out.visible_scroll_x,doc_out.visible_scroll_y,
			obj.x,obj.y+current_y,obj.w,h_out,
			"doc_out_"+i.toString())
		current_y+=h_out+obj.h_gap;
	}
	//todo: cell creation, tab, save
	UI.End()
	return obj
}
