package main
import("encoding/json";"os";"text/template";"strings")
func main(){b,e:=os.ReadFile(os.Args[1]);if e!=nil{panic(e)};t,e:=template.New("actual native structural predicate").Funcs(template.FuncMap{"split":strings.Split}).Parse(string(b));if e!=nil{panic(e)};var c any;if e=json.NewDecoder(os.Stdin).Decode(&c);e!=nil{panic(e)};if e=t.Execute(os.Stdout,c);e!=nil{panic(e)}}
