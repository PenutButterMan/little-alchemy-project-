"""Fill In The Drop Downs"""
async function loadElements() {
    const { data, error } = await supabase
        .from('elements')
        .select('*');

"""Grabs Two Elements From HTML"""
    const dropdown1 = document.getElementById('element1');
    const dropdown2 = document.getElementById('element2');

    data.forEach(element => {
        let option1 = new Option(element.element_name, element.id);
        let option2 = new Option(element.element_name, element.id);

        dropdown1.add(option1);
        dropdown2.add(option2);
    });
}
"""Combine Elements"""
async function combineElements() {
    const e1 = document.getElementById('element1').value;
    const e2 = document.getElementById('element2').value;

    const { data, error } = await supabase
        .from('combinations')
        .select('result_id')
        .or(`and(element1_id.eq.${e1},element2_id.eq.${e2}),and(element1_id.eq.${e2},element2_id.eq.${e1})`);

"""In Case No Result Is Found"""
    if (data.length === 0) {
        document.getElementById('result').innerText = "Result: Nothing found";
        return;
    }

    const resultId = data[0].result_id;

"""Getting Result Name"""
    const { data: resultData } = await supabase
        .from('elements')
        .select('element_name')
        .eq('id', resultId)
        .single();

    document.getElementById('result').innerText = "Result: " + resultData.element_name;
}

loadElements();
