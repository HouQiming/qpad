var UI=require("gui2d/ui");
var W=require("gui2d/widgets");
var LanguageDefinition=function(owner){
	this.m_existing_tokens={};
	this.m_big_chars=[];
	this.m_bracket_types=[];
	this.m_entry_states=[];
	this.m_contradiction_fixes=[];
	this.m_coloring_rules=[];
	this.m_color_default="color";
	this.m_keyword_sets=[];
	this.m_word_dfa_initial_state=[-1];
	this.m_word_dfa_initial_state_triggered=[-1];
	this.m_trigger_char=undefined;
	////////////////
	this.m_owner=owner
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
		if(stoken.length>=64){
			throw new Error("bigchar too long, 63 should have been enough")
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
			this.m_owner.m_lbracket_tokens=((typeof stok0=="string")?[stok0]:stok0)
			this.m_owner.m_rbracket_tokens=((typeof stok1=="string")?[stok1]:stok1)
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
		this.m_word_dfa_initial_state_triggered.push(-1)
	},
	ColoredDelimiter:function(type,stok0,stok1,color_name){
		var bid=this.DefineDelimiter(type,stok0,stok1)
		this.AddColorRule(bid,color_name);
		if(color_name=="color_comment"){
			if(stok1=='\n'){
				this.m_owner.line_comment=stok0
			}else{
				this.m_owner.paired_comment=[stok0,stok1]
			}
		}
		return bid;
	},
	/////////////////
	isInside:function(bid){
		if(!this.m_bracket_types[bid].is_key){throw new Error("isInside only works on key brackets");}
		return this.m_inside_mask&(1<<bid);
	},
	Enable:function(bid){
		this.m_enabling_mask|=(1<<bid);
	},
	Disable:function(bid){
		this.m_enabling_mask&=~(1<<bid);
		this.DisableToken(this.m_bracket_types[bid].tok0);
		this.DisableToken(this.m_bracket_types[bid].tok1);
	},
	EnableToken:function(tok){
		this.m_token_enabling_mask|=(1<<tok);
	},
	DisableToken:function(tok){
		this.m_token_enabling_mask&=~(1<<tok);
	},
	/////////////////
	SetExclusive:function(bids){
		for(var i=0;i<bids.length;i++){
			if(this.isInside(bids[i])){
				for(var j=0;j<bids.length;j++){
					if(j!=i){
						this.Disable(bids[j]);
					}else{
						this.Enable(bids[i]);
					}
				}
				return;
			}
		}
		for(var i=0;i<bids.length;i++){
			this.Enable(bids[i]);
		}
	},
	/////////////////
	DefineKeywordSet:function(s_for_color,ch_triggering){
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
		var states=(ch_triggering?this.m_word_dfa_initial_state_triggered:this.m_word_dfa_initial_state)
		if(states[id]!=-1){throw new Error("color @1 already has a keyword set".replace("@1",s_for_color));}
		states[id]=this.m_keyword_sets.length-1;
		if(ch_triggering){
			if(typeof ch_triggering!="string"){ch_triggering=ch_triggering.join("")}
			if(this.m_trigger_char){
				if(this.m_trigger_char!=ch_triggering){throw new Error("only one set of triggering chars is supported")}
			}else{
				this.m_trigger_char=ch_triggering
			}
		}
		return ret;
	},
	DefineDefaultColor:function(s_color){
		this.m_color_default=s_color;
	},
	/////////////////
	Finalize:function(fenabler){
		var brackets=this.m_bracket_types;
		for(var i=1;i<brackets.length;i++){
			if(brackets[i].is_key>brackets[i-1].is_key||brackets[i].is_key==brackets[i-1].is_key&&brackets[i].type<brackets[i-1].type){
				throw new Error("key brackets must appear before nested ones, pairs must appear before self-paired ones: failed at @1".replace("@1","#"+i))
			}
		}
		//brackets.sort(function(a,b){
		//	return (b.is_key-a.is_key||a.type-b.type);
		//})
		var n_keys=brackets.length;
		for(var i=0;i<brackets.length;i++){
			if(!brackets[i].is_key){n_keys=i;break;}
		}
		if(n_keys>12){
			throw new Error("too many key brackets (only 12 supported), do you really have that much inter-bracket dependency?")
		}
		if(brackets.length>=32){
			throw new Error("too many bracket types, 31 types is surely enough?")
		}
		if(this.m_big_chars.length>=32){
			throw new Error("too many tokens, 31 tokens is surely enough?")
		}
		var n_combos=(1<<n_keys);
		var bidmap={};
		for(var j=0;j<brackets.length;j++){
			bidmap[brackets[j].bid]=j;
		}
		for(var mask_i=0;mask_i<n_combos;mask_i++){
			this.m_enabling_mask=0;
			this.m_token_enabling_mask=(1<<this.m_big_chars.length)-1;
			this.m_inside_mask=0;
			for(var j=0;j<n_keys;j++){
				var bracket_j=brackets[j];
				if(bracket_j.type==REAL_TYPE_MOV){
					if(mask_i&(1<<j)){
						//if inside, default-disable tok0
						for(var k=0;k<bracket_j.tok0.length;k++){
							this.m_token_enabling_mask&=~(1<<bracket_j.tok0[k]);
						}
					}else{
						for(var k=0;k<bracket_j.tok1.length;k++){
							this.m_token_enabling_mask&=~(1<<bracket_j.tok1[k]);
						}
					}
				}
				if(mask_i&(1<<j)){
					this.m_inside_mask|=(1<<bracket_j.bid);
				}
			}
			this.m_enabling_mask|=this.m_inside_mask;
			fenabler(this);
			this.m_contradiction_fixes[this.m_inside_mask]=(this.m_enabling_mask&this.m_inside_mask)
			if((this.m_enabling_mask&this.m_inside_mask)!=this.m_inside_mask){
				//self-contradicting, add a correcting entry
				continue
			}
			var raw_enabling_mask=0;
			for(var j=0;j<brackets.length;j++){
				if(this.m_enabling_mask&(1<<brackets[j].bid)){
					raw_enabling_mask|=(1<<j);
				}
			}
			this.m_entry_states.push({inside:mask_i,enabled:raw_enabling_mask,token_enabled:this.m_token_enabling_mask})
		}
		if(this.m_entry_states.length>64){
			throw new Error("there are @1 entry states, but the system only supports 64".replace("@1",this.m_entry_states.length))
		}
		var inside_mask_to_enabled_mask={};
		for(var i=0;i<this.m_entry_states.length;i++){
			var est=this.m_entry_states[i]
			inside_mask_to_enabled_mask[est.inside]=est.enabled
		}
		this.m_owner.m_entry_states=this.m_entry_states
		this.m_owner.m_inside_mask_to_enabled_mask=inside_mask_to_enabled_mask
		if(brackets.length&&brackets[brackets.length-1].type==REAL_TYPE_ADD){
			this.m_owner.m_bracket_enabling_mask=1<<(brackets.length-1)
		}else{
			this.m_owner.m_bracket_enabling_mask=0;
		}
		//translate m_coloring_rules
		if(this.m_coloring_rules.length>63){
			throw new Error("there are @1 coloring rules, but the system only supports 63".replace("@1",this.m_coloring_rules.length))
		}
		for(var i=0;i<this.m_coloring_rules.length;i++){
			this.m_coloring_rules[i].bid=bidmap[this.m_coloring_rules[i].bid];
		}
		//a copy of keywords in the desc
		var all_ids=[]
		this.m_owner.m_all_keywords=all_ids
		for(var i=0;i<this.m_keyword_sets.length;i++){
			var ksi=this.m_keyword_sets[i].m_keywords
			for(var j=0;j<ksi.length;j++){
				all_ids.push(ksi[j])
			}
		}
	},
	SetSpellCheckedColor:function(color){
		this.m_color_id_spell_check=color
	},
	SetKeyDeclsBaseColor:function(color){
		this.m_color_id_key_decl=color
	},
};

exports.Define=function(frules,owner){
	var ret=new LanguageDefinition(owner);
	var fenabler=frules(ret);
	try{
		ret.Finalize(fenabler);
		return UI.CreateLanguageDefinition(ret);
	}catch(err){
		err.message="Error in language definition "+owner.name+"\n"+err.message
		throw err
	}
};

var g_name_by_ext={}
var g_desc_by_name={}

exports.m_all_languages=[];

exports.GetNameByExt=function(s_ext){
	var assoc=UI.m_ui_metadata["language_assoc"];
	if(!assoc||typeof(assoc)!='object'){
		assoc={};
		UI.m_ui_metadata["language_assoc"]=assoc;
	}
	var s_ext_lower=s_ext.toLowerCase();
	return (assoc[s_ext_lower]||g_name_by_ext[s_ext_lower]||"Plain text")
}

exports.GetDefinitionByName=function(s_name){
	var desc=g_desc_by_name[s_name];
	if(!desc){desc=g_desc_by_name["Plain text"];}
	if(!desc.definition){
		desc.definition=exports.Define(desc.rules.bind(desc),desc)
	}
	return desc.definition
}

exports.GetDescObjectByName=function(s_name){
	return g_desc_by_name[s_name]||g_desc_by_name["Plain text"];
}

exports.g_all_extensions=[];
exports.Register=function(desc){
	exports.m_all_languages.push(desc)
	g_desc_by_name[desc.name]=desc
	if(desc.extensions){
		for(var i=0;i<desc.extensions.length;i++){
			var s_ext_i=desc.extensions[i].toLowerCase();
			g_name_by_ext[s_ext_i]=desc.name
			exports.g_all_extensions.push(s_ext_i);
		}
	}
}

///////////////////////////////////
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
};

///////////////////////////////////
var g_cached_hyphenators={}
exports.GetHyphenator=function(lang){
	var ret=g_cached_hyphenators[lang]
	if(!ret){
		var sdata=IO.UIReadAll("res/misc/"+lang+".dfa")
		if(!sdata){
			sdata=IO.ReadAll(System.Env.GetExecutablePath()+"res/misc/"+lang+".dfa")
			if(!sdata){
				sdata=IO.ReadAll(System.Env.GetExecutablePath()+"res/misc/"+lang+".tex")
			}
		}
		if(sdata){
			ret=UI.ParseHyphenator(sdata);
		}
		g_cached_hyphenators[lang]=ret
	}
	return ret;
}
