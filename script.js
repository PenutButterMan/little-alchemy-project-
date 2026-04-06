async function loadElements() {
    const { data, error } = await supabase
        .from('elements')
        .select('*');

    const dropdown1 = document.getElementById('element1');
    const dropdown2 = document.getElementById('element2');

    data.forEach(element => {
        let option1 = new Option(element.element_name, element.id);
        let option2 = new Option(element.element_name, element.id);

        dropdown1.add(option1);
        dropdown2.add(option2);
    });
}

async function combineElements() {
    const e1 = document.getElementById('element1').value;
    const e2 = document.getElementById('element2').value;

    const { data, error } = await supabase
        .from('combinations')
        .select('result_id')
        .or(`and(element1_id.eq.${e1},element2_id.eq.${e2}),and(element1_id.eq.${e2},element2_id.eq.${e1})`);

    if (data.length === 0) {
        document.getElementById('result').innerText = "Result: Nothing found";
        return;
    }

    const resultId = data[0].result_id;

    const { data: resultData } = await supabase
        .from('elements')
        .select('element_name')
        .eq('id', resultId)
        .single();

    document.getElementById('result').innerText = "Result: " + resultData.element_name;
}

loadElements();
