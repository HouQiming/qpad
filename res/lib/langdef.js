var UI=require("gui2d/ui");
var W=require("gui2d/widgets");
var LanguageDefinition=function(){
	this.m_existing_tokens={};
	this.m_big_chars=[];
	this.m_bracket_types=[];
	this.m_entry_states=[];
	this.m_coloring_rules=[];
	this.m_color_default="color";
	this.m_keyword_sets=[];
	this.m_word_dfa_initial_state=[-1];
};
var REAL_TYPE_MOV=0;
var REAL_TYPE_XOR=1;
var REAL_TYPE_ADD=2;
LanguageDefinition.prototype={
	DefineToken:function(stoken){
		if(typeof stoken!="string"){
			//it's a set
			var ret=[];
			for(var i=0;i<stoken.length;i++){
				ret[i]=this.DefineToken(stoken[i])[0];
			}
			return ret;
		}
		var n=this.m_existing_tokens[stoken];
		if(n!=undefined){return [n];}
		n=(this.m_big_chars.length);
		this.m_big_chars.push(stoken)
		if(n>=128){throw new Error("too many bigchars, 127 should have been enough")}
		if(Duktape.__byte_length(stoken)>64){throw new Error("bigchar too long, 64 should have been enough")}
		this.m_existing_tokens[stoken]=n
		return [n];
	},
	DefineDelimiter:function(type,stok0,stok1){
		var real_type;
		var tok0=this.DefineToken(stok0);
		var tok1=this.DefineToken(stok1);
		if(type=="nested"){
			real_type=REAL_TYPE_ADD;
		}else{
			if(tok0.length==1&&tok1.length==1&&tok0[0]==tok1[0]){
				real_type=REAL_TYPE_XOR;
			}else{
				real_type=REAL_TYPE_MOV;
			}
			if(type!="key"&&type!="normal"){
				throw new Error("invalid delimiter type '@1'".replace("@1",type));
			}
		}
		var bid=this.m_bracket_types.length;
		this.m_bracket_types.push({type:real_type,is_key:(type=="key")|0,bid:bid,tok0:tok0,tok1:tok1});
		return bid;
	},
	AddColorRule:function(bid,color_name){
		//coloring... bracket range + delta, later-overwrite-earlier rules
		//nested brackets not allowed
		if(!(bid<this.m_bracket_types.length&&bid>=0)){
			throw new Error("bad delimiter id");
		}
		this.m_coloring_rules.push({bid:bid,color_name:color_name});
		this.m_word_dfa_initial_state.push(-1)
	},
	ColoredDelimiter:function(type,stok0,stok1,color_name){
		var bid=this.DefineDelimiter(type,stok0,stok1)
		this.AddColorRule(bid,color_name);
		return bid;
	},
	/////////////////
	isInside:function(bid){
		if(!this.m_bracket_types[bid].is_key){throw "isInside only works on key brackets";}
		return this.m_inside_mask&(1<<bid);
	},
	Enable:function(bid){
		this.m_enabling_mask|=(1<<bid);
	},
	Disable:function(bid){
		this.m_enabling_mask&=~(1<<bid);
	},
	/////////////////
	SetExclusive:function(bids){
		for(var i=0;i<bids.length;i++){
			this.Enable(bids[i]);
		}
		for(var i=0;i<bids.length;i++){
			if(this.isInside(bids[i])){
				for(var j=0;j<bids.length;j++){
					this.Disable(bids[j]);
				}
				this.Enable(bids[i]);
				break;
			}
		}
	},
	/////////////////
	DefineKeywordSet:function(s_for_color){
		var ret=new KeywordSet()
		this.m_keyword_sets.push(ret)
		var id=-1;
		if(s_for_color==this.m_color_default){
			id=0
		}else{
			for(var i=0;i<this.m_coloring_rules.length;i++){
				if(s_for_color==this.m_coloring_rules[i].color_name){
					id=i+1;
					break;
				}
			}
		}
		if(id<0){throw new Error("please define color @1 in a rule before defining its keyword set".replace("@1",s_for_color));}
		if(this.m_word_dfa_initial_state[id]!=-1){throw new Error("color @1 already has a keyword set".replace("@1",s_for_color));}
		this.m_word_dfa_initial_state[id]=this.m_keyword_sets.length-1;
		return ret;
	},
	DefineDefaultColor:function(s_color){
		this.m_color_default=s_color;
	},
	/////////////////
	Finalize:function(fenabler){
		var bras=this.m_bracket_types;
		bras.sort(function(a,b){
			return (b.is_key-a.is_key||a.type-b.type);
		})
		var n_keys=bras.length;
		for(var i=0;i<bras.length;i++){
			if(!bras[i].is_key){n_keys=i;break;}
		}
		if(n_keys>12){
			throw new Error("too many key brackets, do you really have that much inter-bracket dependency?")
		}
		if(bras.length>=32){
			throw new Error("too many bracket types, 31 types is surely enough?")
		}
		var n_combos=(1<<n_keys);
		var bidmap={};
		for(var j=0;j<bras.length;j++){
			bidmap[bras[j].bid]=j;
		}
		for(var mask_i=0;mask_i<n_combos;mask_i++){
			this.m_enabling_mask=0;
			this.m_inside_mask=0;
			for(var j=0;j<n_keys;j++){
				if(mask_i&(1<<j)){
					this.m_inside_mask|=(1<<bras[j].bid);
				}
			}
			this.m_enabling_mask|=this.m_inside_mask;
			fenabler(this);
			if((this.m_enabling_mask&this.m_inside_mask)!=this.m_inside_mask){
				//self-contradicting, ignore it
				continue
			}
			var raw_enabling_mask=0;
			for(var j=0;j<bras.length;j++){
				if(this.m_enabling_mask&(1<<bras[j].bid)){
					raw_enabling_mask|=(1<<j);
				}
			}
			this.m_entry_states.push({inside:mask_i,enabled:raw_enabling_mask})
		}
		if(this.m_entry_states.length>64){
			throw new Error("there are @1 entry states, but the system only supports 64".replace("@1",this.m_entry_states.length))
		}
		//translate m_coloring_rules
		if(this.m_coloring_rules.length>63){
			throw new Error("there are @1 coloring rules, but the system only supports 63".replace("@1",this.m_coloring_rules.length))
		}
		for(var i=0;i<this.m_coloring_rules.length;i++){
			this.m_coloring_rules[i].bid=bidmap[this.m_coloring_rules[i].bid];
		}
	},
};

exports.Define=function(frules,fenabler){
	var ret=new LanguageDefinition();
	var fenabler=frules(ret);
	ret.Finalize(fenabler);
	return UI.CreateLanguageDefinition(ret);
};

///////////////////////////////////
var Edit_prototype=W.Edit_prototype;
Edit_prototype.GetBracketLevel=function(ccnt){
	var ed=this.ed;
	return ed.GetStateAt(ed.m_handler_registration["colorer"],ccnt,"lll")[1];
};
Edit_prototype.FindBracket=function(n_brackets,ccnt,direction){
	var ed=this.ed;
	var ret=ed.FindNearest(ed.m_handler_registration["colorer"],[0,n_brackets],"ll",ccnt,direction);
	if(ret==-1){
		if(direction<0){
			return 0;
		}else{
			return ed.GetTextSize();
		}
	}
	return ret;
};
Edit_prototype.FindOuterBracket=function(ccnt,direction){
	return this.FindBracket(this.GetBracketLevel(ccnt)-1,ccnt,direction);
};

var KeywordSet=function(){
	this.m_keywords=[];
	this.m_word_openers=[];
	this.m_word_color_default="color";
}
KeywordSet.prototype={
	DefineKeywords:function(s_color,keywords){
		for(var i=0;i<keywords.length;i++){
			var s=keywords[i];
			this.m_keywords.push(s)
			this.m_keywords.push(s_color)
		}
	},
	DefineWordType:function(s_color,s_charset){
		this.m_word_openers.push(s_charset,s_color)
	},
	DefineWordColor:function(s_color){
		this.m_word_color_default=s_color;
	},
}
